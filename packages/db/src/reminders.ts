import type { OneOffReminder } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { getRedis } from "./client";

const reminderKey = (userId: string) => `reminder:${userId}`;
const reminderTimesKey = (userId: string) => `reminder_times:${userId}`;
const oneOffRemindersKey = (userId: string) => `one_off_reminders:${userId}`;

export interface CustomReminderTime {
  label: string;
  hour: number;
  minute: number;
}

export async function setReminderRunId(userId: string, runId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(reminderKey(userId), runId);
}

export async function getReminderRunId(userId: string): Promise<string | null> {
  const redis = getRedis();
  return await redis.get<string>(reminderKey(userId));
}

export async function deleteReminderRunId(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(reminderKey(userId));
}

export async function setCustomReminderTimes(
  userId: string,
  times: CustomReminderTime[],
): Promise<void> {
  const redis = getRedis();
  const enc = await encryptContent(JSON.stringify(times));
  await redis.set(reminderTimesKey(userId), enc);
}

export async function getCustomReminderTimes(userId: string): Promise<CustomReminderTime[] | null> {
  const redis = getRedis();
  const raw = await redis.get(reminderTimesKey(userId));
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as CustomReminderTime[];
  if (typeof raw !== "string") return null;
  const decrypted = await decrypt(raw);
  return JSON.parse(decrypted) as CustomReminderTime[];
}

export async function deleteCustomReminderTimes(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(reminderTimesKey(userId));
}

async function encodeOneOffReminder(reminder: OneOffReminder): Promise<string> {
  return encryptContent(JSON.stringify(reminder));
}

async function decodeOneOffReminder(raw: string): Promise<OneOffReminder> {
  return JSON.parse(await decrypt(raw)) as OneOffReminder;
}

export async function createOneOffReminder(reminder: OneOffReminder): Promise<void> {
  const redis = getRedis();
  await redis.hset(oneOffRemindersKey(reminder.userId), {
    [reminder.id]: await encodeOneOffReminder(reminder),
  });
}

export async function getOneOffReminder(
  userId: string,
  reminderId: string,
): Promise<OneOffReminder | null> {
  const redis = getRedis();
  const raw = await redis.hget<string>(oneOffRemindersKey(userId), reminderId);
  if (!raw || typeof raw !== "string") return null;
  return decodeOneOffReminder(raw);
}

export async function listOneOffReminders(userId: string): Promise<OneOffReminder[]> {
  const redis = getRedis();
  const data = await redis.hgetall<Record<string, string>>(oneOffRemindersKey(userId));
  if (!data) return [];

  const reminders: OneOffReminder[] = [];
  for (const raw of Object.values(data)) {
    if (typeof raw === "string") {
      reminders.push(await decodeOneOffReminder(raw));
    }
  }

  return reminders.sort((a, b) => a.sendAt.localeCompare(b.sendAt));
}

async function updateOneOffReminder(
  userId: string,
  reminderId: string,
  changes: Partial<OneOffReminder>,
): Promise<OneOffReminder | null> {
  const existing = await getOneOffReminder(userId, reminderId);
  if (!existing) return null;

  const updated: OneOffReminder = {
    ...existing,
    ...changes,
    userId: existing.userId,
    id: existing.id,
    updatedAt: changes.updatedAt ?? new Date().toISOString(),
  };
  await createOneOffReminder(updated);
  return updated;
}

export async function setOneOffReminderWorkflowRunId(
  userId: string,
  reminderId: string,
  workflowRunId: string,
): Promise<OneOffReminder | null> {
  return updateOneOffReminder(userId, reminderId, { workflowRunId });
}

export async function markOneOffReminderSent(
  userId: string,
  reminderId: string,
): Promise<OneOffReminder | null> {
  const now = new Date().toISOString();
  return updateOneOffReminder(userId, reminderId, {
    status: "sent",
    sentAt: now,
    updatedAt: now,
  });
}

export async function cancelOneOffReminder(
  userId: string,
  reminderId: string,
): Promise<OneOffReminder | null> {
  const now = new Date().toISOString();
  return updateOneOffReminder(userId, reminderId, {
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
  });
}

export async function markOneOffReminderFailed(
  userId: string,
  reminderId: string,
): Promise<OneOffReminder | null> {
  const now = new Date().toISOString();
  return updateOneOffReminder(userId, reminderId, {
    status: "failed",
    failedAt: now,
    updatedAt: now,
  });
}
