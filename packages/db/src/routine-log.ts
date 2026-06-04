import type { DailyRoutineLog, RoutineLogEntry, RoutineSlot } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { routineEntries } from "./schema";

function safeParseArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return JSON.parse(val) as unknown[];
  return [];
}

async function parseRoutineEntry(
  id: string,
  data: Record<string, unknown>,
  fallbackUserId?: string,
  fallbackDate?: string,
): Promise<RoutineLogEntry> {
  const stepsRaw = data.steps ? await decrypt(String(data.steps)) : "[]";
  const reactionRaw = data.reaction ? await decrypt(String(data.reaction)) : "";
  const notesRaw = data.notes ? await decrypt(String(data.notes)) : "";
  const sourceRaw = data.source ? await decrypt(String(data.source)) : "text";

  return {
    id,
    userId: String(data.userId ?? fallbackUserId ?? ""),
    slot: String(data.slot ?? "custom") as RoutineSlot,
    steps: safeParseArray(stepsRaw) as RoutineLogEntry["steps"],
    completed: String(data.completed) === "true",
    reaction: reactionRaw || undefined,
    notes: notesRaw || undefined,
    source: String(sourceRaw || "text") as RoutineLogEntry["source"],
    timestamp: String(data.timestamp ?? new Date().toISOString()),
    localDate: String(data.localDate ?? fallbackDate ?? ""),
  };
}

export async function saveRoutineEntry(entry: RoutineLogEntry): Promise<void> {
  const [steps, reaction, notes, source] = await Promise.all([
    encryptContent(JSON.stringify(entry.steps)),
    encryptContent(entry.reaction ?? ""),
    encryptContent(entry.notes ?? ""),
    encryptContent(entry.source),
  ]);

  await getDb()
    .insert(routineEntries)
    .values({
      id: entry.id,
      userId: entry.userId,
      slot: entry.slot,
      steps,
      completed: entry.completed,
      reaction,
      notes,
      source,
      timestamp: entry.timestamp,
      localDate: entry.localDate,
    })
    .onConflictDoUpdate({
      target: routineEntries.id,
      set: {
        userId: entry.userId,
        slot: entry.slot,
        steps,
        completed: entry.completed,
        reaction,
        notes,
        source,
        timestamp: entry.timestamp,
        localDate: entry.localDate,
        updatedAt: sql`now()`,
      },
    });
}

export async function getRoutineEntry(entryId: string): Promise<RoutineLogEntry | null> {
  const data = await getDb().query.routineEntries.findFirst({
    where: eq(routineEntries.id, entryId),
  });
  if (!data) return null;
  return parseRoutineEntry(entryId, data);
}

export async function deleteRoutineEntry(
  entryId: string,
  userId: string,
  localDate: string,
): Promise<void> {
  await getDb()
    .delete(routineEntries)
    .where(
      and(
        eq(routineEntries.id, entryId),
        eq(routineEntries.userId, userId),
        eq(routineEntries.localDate, localDate),
      ),
    );
}

export async function getRoutineLogForDate(
  userId: string,
  localDate: string,
): Promise<DailyRoutineLog> {
  const rows = await getDb().query.routineEntries.findMany({
    where: and(eq(routineEntries.userId, userId), eq(routineEntries.localDate, localDate)),
    orderBy: asc(routineEntries.timestamp),
  });
  if (rows.length === 0) {
    return {
      entries: [],
      entryCount: 0,
      completedSlots: [],
      productsUsed: [],
      reactions: [],
    };
  }

  const entries: RoutineLogEntry[] = [];
  for (const row of rows) {
    entries.push(await parseRoutineEntry(row.id, row, userId, localDate));
  }

  const completedSlots = Array.from(new Set(entries.filter((e) => e.completed).map((e) => e.slot)));
  const productsUsed = Array.from(
    new Set(entries.flatMap((e) => e.steps.map((s) => s.productName).filter(Boolean) as string[])),
  );
  const reactions = entries.map((e) => e.reaction).filter(Boolean) as string[];

  return {
    entries,
    entryCount: entries.length,
    completedSlots,
    productsUsed,
    reactions,
  };
}

export async function getWeeklyRoutineLogs(
  userId: string,
  endDate: string,
): Promise<{ date: string; log: DailyRoutineLog }[]> {
  const end = parseISO(endDate);
  const dates = Array.from({ length: 7 }, (_, i) => format(subDays(end, 6 - i), "yyyy-MM-dd"));
  const logs = await Promise.all(dates.map((d) => getRoutineLogForDate(userId, d)));
  return dates.map((date, i) => ({ date, log: logs[i]! }));
}
