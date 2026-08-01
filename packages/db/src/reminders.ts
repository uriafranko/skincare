import type { OneOffReminder } from "@skintext/shared";
import { and, asc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { customReminderTimes, oneOffReminders, reminderRunIds } from "./schema";

export interface CustomReminderTime {
  label: string;
  hour: number;
  minute: number;
}

export interface ReminderRunRecord {
  userId: string;
  runId: string;
  deploymentId: string | null;
  generation: string | null;
  migrationId: string | null;
  migrationStartedAt: Date | null;
}

export async function setReminderRunId(
  userId: string,
  runId: string,
  options: { deploymentId?: string; generation?: string } = {},
): Promise<void> {
  await getDb()
    .insert(reminderRunIds)
    .values({
      userId,
      runId,
      deploymentId: options.deploymentId,
      generation: options.generation,
    })
    .onConflictDoUpdate({
      target: reminderRunIds.userId,
      set: {
        runId,
        deploymentId: options.deploymentId,
        generation: options.generation,
        migrationId: null,
        migrationStartedAt: null,
        updatedAt: sql`now()`,
      },
    });
}

export async function getReminderRun(userId: string): Promise<ReminderRunRecord | null> {
  const row = await getDb().query.reminderRunIds.findFirst({
    where: eq(reminderRunIds.userId, userId),
  });
  if (!row) return null;
  return {
    userId: row.userId,
    runId: row.runId,
    deploymentId: row.deploymentId,
    generation: row.generation,
    migrationId: row.migrationId,
    migrationStartedAt: row.migrationStartedAt,
  };
}

export async function getReminderRunId(userId: string): Promise<string | null> {
  return (await getReminderRun(userId))?.runId ?? null;
}

export async function deleteReminderRunId(userId: string, generation?: string): Promise<void> {
  await getDb()
    .delete(reminderRunIds)
    .where(
      generation
        ? and(eq(reminderRunIds.userId, userId), eq(reminderRunIds.generation, generation))
        : eq(reminderRunIds.userId, userId),
    );
}

export async function isReminderRunGenerationCurrent(
  userId: string,
  generation: string,
): Promise<boolean> {
  const row = await getDb().query.reminderRunIds.findFirst({
    where: and(eq(reminderRunIds.userId, userId), eq(reminderRunIds.generation, generation)),
  });
  return !!row;
}

export async function listReminderRunsNeedingMigration(
  deploymentId: string,
  limit: number,
): Promise<ReminderRunRecord[]> {
  const rows = await getDb().query.reminderRunIds.findMany({
    where: or(
      isNull(reminderRunIds.deploymentId),
      ne(reminderRunIds.deploymentId, deploymentId),
      isNull(reminderRunIds.generation),
    ),
    orderBy: asc(reminderRunIds.userId),
    limit,
  });
  return rows.map((row) => ({
    userId: row.userId,
    runId: row.runId,
    deploymentId: row.deploymentId,
    generation: row.generation,
    migrationId: row.migrationId,
    migrationStartedAt: row.migrationStartedAt,
  }));
}

export async function claimReminderRunMigration(input: {
  userId: string;
  runId: string;
  deploymentId: string;
  migrationId: string;
  leaseExpiredBefore: Date;
}): Promise<boolean> {
  const rows = await getDb()
    .update(reminderRunIds)
    .set({
      generation: input.migrationId,
      migrationId: input.migrationId,
      migrationStartedAt: new Date(),
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(reminderRunIds.userId, input.userId),
        eq(reminderRunIds.runId, input.runId),
        or(
          isNull(reminderRunIds.deploymentId),
          ne(reminderRunIds.deploymentId, input.deploymentId),
          isNull(reminderRunIds.generation),
        ),
        or(
          isNull(reminderRunIds.migrationStartedAt),
          lt(reminderRunIds.migrationStartedAt, input.leaseExpiredBefore),
        ),
      ),
    )
    .returning({ userId: reminderRunIds.userId });
  return rows.length > 0;
}

export async function prepareReminderRunStart(input: {
  userId: string;
  deploymentId: string;
  generation: string;
}): Promise<boolean> {
  const rows = await getDb()
    .insert(reminderRunIds)
    .values({
      userId: input.userId,
      runId: `pending:${input.generation}`,
      deploymentId: input.deploymentId,
      generation: input.generation,
    })
    .onConflictDoNothing()
    .returning({ userId: reminderRunIds.userId });
  return rows.length > 0;
}

export async function completeReminderRunStart(input: {
  userId: string;
  expectedRunId: string;
  deploymentId: string;
  generation: string;
  runId: string;
}): Promise<boolean> {
  const rows = await getDb()
    .update(reminderRunIds)
    .set({
      runId: input.runId,
      deploymentId: input.deploymentId,
      generation: input.generation,
      migrationId: null,
      migrationStartedAt: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(reminderRunIds.userId, input.userId),
        eq(reminderRunIds.runId, input.expectedRunId),
        eq(reminderRunIds.generation, input.generation),
      ),
    )
    .returning({ userId: reminderRunIds.userId });
  return rows.length > 0;
}

export async function releaseReminderRunMigration(input: {
  userId: string;
  runId: string;
  migrationId: string;
}): Promise<void> {
  await getDb()
    .update(reminderRunIds)
    .set({
      migrationId: null,
      migrationStartedAt: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(reminderRunIds.userId, input.userId),
        eq(reminderRunIds.runId, input.runId),
        eq(reminderRunIds.migrationId, input.migrationId),
      ),
    );
}

export async function setCustomReminderTimes(
  userId: string,
  times: CustomReminderTime[],
): Promise<void> {
  const value = JSON.stringify(times);
  await getDb()
    .insert(customReminderTimes)
    .values({ userId, value })
    .onConflictDoUpdate({
      target: customReminderTimes.userId,
      set: { value, updatedAt: sql`now()` },
    });
}

export async function getCustomReminderTimes(userId: string): Promise<CustomReminderTime[] | null> {
  const row = await getDb().query.customReminderTimes.findFirst({
    where: eq(customReminderTimes.userId, userId),
  });
  if (!row) return null;
  return JSON.parse(row.value) as CustomReminderTime[];
}

export async function deleteCustomReminderTimes(userId: string): Promise<void> {
  await getDb().delete(customReminderTimes).where(eq(customReminderTimes.userId, userId));
}

function encodeOneOffReminder(reminder: OneOffReminder): string {
  return JSON.stringify(reminder);
}

function decodeOneOffReminder(raw: string): OneOffReminder {
  return JSON.parse(raw) as OneOffReminder;
}

export async function createOneOffReminder(reminder: OneOffReminder): Promise<void> {
  const value = encodeOneOffReminder(reminder);
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
