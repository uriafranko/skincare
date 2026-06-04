import type { DailyRoutineLog, RoutineLogEntry, RoutineSlot } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { getRedis } from "./client";

const routineEntryKey = (id: string) => `routine_entry:${id}`;
const routineLogIndexKey = (userId: string, localDate: string) =>
  `routine_logs:${userId}:${localDate}`;

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
  const redis = getRedis();
  const [steps, reaction, notes, source] = await Promise.all([
    encryptContent(JSON.stringify(entry.steps)),
    encryptContent(entry.reaction ?? ""),
    encryptContent(entry.notes ?? ""),
    encryptContent(entry.source),
  ]);

  const pipeline = redis.pipeline();
  pipeline.hset(routineEntryKey(entry.id), {
    userId: entry.userId,
    slot: entry.slot,
    steps,
    completed: String(entry.completed),
    reaction,
    notes,
    source,
    timestamp: entry.timestamp,
    localDate: entry.localDate,
  });
  pipeline.zadd(routineLogIndexKey(entry.userId, entry.localDate), {
    score: new Date(entry.timestamp).getTime(),
    member: entry.id,
  });
  await pipeline.exec();
}

export async function getRoutineEntry(entryId: string): Promise<RoutineLogEntry | null> {
  const redis = getRedis();
  const data = await redis.hgetall(routineEntryKey(entryId));
  if (!data || Object.keys(data).length === 0) return null;
  return parseRoutineEntry(entryId, data as Record<string, unknown>);
}

export async function deleteRoutineEntry(
  entryId: string,
  userId: string,
  localDate: string,
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.del(routineEntryKey(entryId));
  pipeline.zrem(routineLogIndexKey(userId, localDate), entryId);
  await pipeline.exec();
}

export async function getRoutineLogForDate(
  userId: string,
  localDate: string,
): Promise<DailyRoutineLog> {
  const redis = getRedis();
  const entryIds = await redis.zrange<string[]>(routineLogIndexKey(userId, localDate), 0, -1);
  if (!entryIds || entryIds.length === 0) {
    return {
      entries: [],
      entryCount: 0,
      completedSlots: [],
      productsUsed: [],
      reactions: [],
    };
  }

  const pipeline = redis.pipeline();
  for (const id of entryIds) {
    pipeline.hgetall(routineEntryKey(id));
  }
  const results = await pipeline.exec();

  const entries: RoutineLogEntry[] = [];
  for (let i = 0; i < entryIds.length; i++) {
    const data = results[i];
    if (!data || Object.keys(data).length === 0) continue;
    entries.push(
      await parseRoutineEntry(entryIds[i]!, data as Record<string, unknown>, userId, localDate),
    );
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
