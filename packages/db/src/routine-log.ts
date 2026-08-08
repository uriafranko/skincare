import type { DailyRoutineLog, RoutineLogEntry, RoutineSlot } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./client";
import { routineEntries } from "./schema";

function safeParseArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return JSON.parse(val) as unknown[];
  return [];
}

function parseRoutineEntry(
  id: string,
  data: Record<string, unknown>,
  fallbackUserId?: string,
  fallbackDate?: string,
): RoutineLogEntry {
  const stepsRaw = data.steps ? String(data.steps) : "[]";
  const reactionRaw = data.reaction ? String(data.reaction) : "";
  const notesRaw = data.notes ? String(data.notes) : "";
  const sourceRaw = data.source ? String(data.source) : "text";

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

function summarizeRoutineEntries(entries: RoutineLogEntry[]): DailyRoutineLog {
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

export async function saveRoutineEntry(entry: RoutineLogEntry): Promise<void> {
  const steps = JSON.stringify(entry.steps);
  const reaction = entry.reaction ?? "";
  const notes = entry.notes ?? "";
  const source = entry.source;

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
  return summarizeRoutineEntries(
    rows.map((row) => parseRoutineEntry(row.id, row, userId, localDate)),
  );
}

export async function getWeeklyRoutineLogs(
  userId: string,
  endDate: string,
): Promise<{ date: string; log: DailyRoutineLog }[]> {
  const end = parseISO(endDate);
  const dates = Array.from({ length: 7 }, (_, i) => format(subDays(end, 6 - i), "yyyy-MM-dd"));
  const rows = await getDb().query.routineEntries.findMany({
    where: and(
      eq(routineEntries.userId, userId),
      gte(routineEntries.localDate, dates[0]!),
      lte(routineEntries.localDate, endDate),
    ),
    orderBy: asc(routineEntries.timestamp),
  });
  const entriesByDate = new Map<string, RoutineLogEntry[]>();

  for (const row of rows) {
    const entry = parseRoutineEntry(row.id, row, userId);
    const entries = entriesByDate.get(entry.localDate);
    if (entries) entries.push(entry);
    else entriesByDate.set(entry.localDate, [entry]);
  }

  return dates.map((date) => ({
    date,
    log: summarizeRoutineEntries(entriesByDate.get(date) ?? []),
  }));
}
