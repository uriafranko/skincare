import type { OneOffReminder } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { customReminderTimes, oneOffReminders, reminderRunIds } from "./schema";

export interface CustomReminderTime {
  label: string;
  hour: number;
  minute: number;
}

export async function setReminderRunId(userId: string, runId: string): Promise<void> {
  await getDb()
    .insert(reminderRunIds)
    .values({ userId, runId })
    .onConflictDoUpdate({
      target: reminderRunIds.userId,
      set: { runId, updatedAt: sql`now()` },
    });
}

export async function getReminderRunId(userId: string): Promise<string | null> {
  const row = await getDb().query.reminderRunIds.findFirst({
    where: eq(reminderRunIds.userId, userId),
  });
  return row?.runId ?? null;
}

export async function deleteReminderRunId(userId: string): Promise<void> {
  await getDb().delete(reminderRunIds).where(eq(reminderRunIds.userId, userId));
}

export async function setCustomReminderTimes(
  userId: string,
  times: CustomReminderTime[],
): Promise<void> {
  const enc = await encryptContent(JSON.stringify(times));
  await getDb()
    .insert(customReminderTimes)
    .values({ userId, value: enc })
    .onConflictDoUpdate({
      target: customReminderTimes.userId,
      set: { value: enc, updatedAt: sql`now()` },
    });
}

export async function getCustomReminderTimes(userId: string): Promise<CustomReminderTime[] | null> {
  const row = await getDb().query.customReminderTimes.findFirst({
    where: eq(customReminderTimes.userId, userId),
  });
  if (!row) return null;
  const decrypted = await decrypt(row.value);
  return JSON.parse(decrypted) as CustomReminderTime[];
}

export async function deleteCustomReminderTimes(userId: string): Promise<void> {
  await getDb().delete(customReminderTimes).where(eq(customReminderTimes.userId, userId));
}

async function encodeOneOffReminder(reminder: OneOffReminder): Promise<string> {
  return encryptContent(JSON.stringify(reminder));
}

async function decodeOneOffReminder(raw: string): Promise<OneOffReminder> {
  return JSON.parse(await decrypt(raw)) as OneOffReminder;
}

export async function createOneOffReminder(reminder: OneOffReminder): Promise<void> {
  const value = await encodeOneOffReminder(reminder);
  await getDb()
    .insert(oneOffReminders)
    .values({
      id: reminder.id,
      userId: reminder.userId,
      value,
      sendAt: reminder.sendAt,
    })
    .onConflictDoUpdate({
      target: oneOffReminders.id,
      set: {
        userId: reminder.userId,
        value,
        sendAt: reminder.sendAt,
        updatedAt: sql`now()`,
      },
    });
}

export async function getOneOffReminder(
  userId: string,
  reminderId: string,
): Promise<OneOffReminder | null> {
  const row = await getDb().query.oneOffReminders.findFirst({
    where: and(eq(oneOffReminders.userId, userId), eq(oneOffReminders.id, reminderId)),
  });
  if (!row) return null;
  return decodeOneOffReminder(row.value);
}

export async function listOneOffReminders(userId: string): Promise<OneOffReminder[]> {
  const rows = await getDb().query.oneOffReminders.findMany({
    where: eq(oneOffReminders.userId, userId),
    orderBy: asc(oneOffReminders.sendAt),
  });

  const reminders: OneOffReminder[] = [];
  for (const row of rows) {
    reminders.push(await decodeOneOffReminder(row.value));
  }

  return reminders;
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
  const existing = await getOneOffReminder(userId, reminderId);
  if (existing?.status !== "scheduled") return existing;

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
