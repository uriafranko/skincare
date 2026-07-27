import { createTool } from "@mastra/core/tools";
import {
  cancelOneOffReminder,
  createOneOffReminder,
  getOneOffReminder,
  listOneOffReminders,
  markOneOffReminderFailed,
  setOneOffReminderWorkflowRunId,
} from "@skintext/db";
import type { OneOffReminder, OneOffReminderKind } from "@skintext/shared";
import { generateId, isValidTimeZone, localDateTimeToDate } from "@skintext/shared";
import { z } from "zod";
import {
  type CancelOneOffReminderWorkflow,
  getSkintextRuntime,
  type ScheduleOneOffReminderWorkflow,
} from "../runtime";

const MAX_HORIZON_DAYS = 180;
const MAX_HORIZON_MS = MAX_HORIZON_DAYS * 24 * 60 * 60 * 1000;

const reminderKindSchema = z.enum(["routine_followup", "skin_checkin", "custom"]);
const relativeUnitSchema = z.enum(["minutes", "hours", "days", "weeks"]);

type RelativeReminderUnit = z.infer<typeof relativeUnitSchema>;

export type OneOffReminderSchedule =
  | {
      type: "relative";
      amount: number;
      unit: RelativeReminderUnit;
    }
  | {
      type: "local_time";
      date: string;
      hour: number;
      minute: number;
    };

export interface ScheduleOneOffReminderInput {
  userId: string;
  timezone: string;
  schedule: OneOffReminderSchedule;
  message: string;
  kind?: OneOffReminderKind;
}

function workflowRunId(result: Awaited<ReturnType<ScheduleOneOffReminderWorkflow>>): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  return result.runId ?? null;
}

async function cancelWorkflowRun(
  cancelWorkflow: CancelOneOffReminderWorkflow | undefined,
  reminder: OneOffReminder,
): Promise<boolean> {
  if (!cancelWorkflow || !reminder.workflowRunId) return false;
  try {
    return await cancelWorkflow({
      userId: reminder.userId,
      reminderId: reminder.id,
      workflowRunId: reminder.workflowRunId,
    });
  } catch {
    return false;
  }
}

function relativeDelayMs(amount: number, unit: RelativeReminderUnit): number {
  const multipliers: Record<RelativeReminderUnit, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

function computeSendAt(schedule: OneOffReminderSchedule, timezone: string, now: Date): Date | null {
  if (schedule.type === "relative") {
    return new Date(now.getTime() + relativeDelayMs(schedule.amount, schedule.unit));
  }

  return localDateTimeToDate(schedule.date, schedule.hour, schedule.minute, timezone);
}

export async function scheduleOneOffReminder(
  input: ScheduleOneOffReminderInput,
  scheduleWorkflow: ScheduleOneOffReminderWorkflow,
  now = new Date(),
) {
  const sendAt = computeSendAt(input.schedule, input.timezone, now);
  if (!sendAt) {
    return { scheduled: false, error: "schedule must be a valid future time." };
  }

  const sendAtMs = sendAt.getTime();
  const nowMs = now.getTime();
  const message = input.message.trim();

  if (sendAtMs <= nowMs) {
    return { scheduled: false, error: "schedule must resolve to a future time." };
  }

  if (sendAtMs - nowMs > MAX_HORIZON_MS) {
    return {
      scheduled: false,
      error: `schedule must be within ${MAX_HORIZON_DAYS} days.`,
    };
  }

  if (!message) {
    return { scheduled: false, error: "message must not be empty." };
  }

  const reminder: OneOffReminder = {
    id: generateId("reminder"),
    userId: input.userId,
    sendAt: sendAt.toISOString(),
    timezone: input.timezone,
    kind: input.kind ?? "custom",
    message,
    status: "scheduled",
    createdAt: now.toISOString(),
  };

  await createOneOffReminder(reminder);

  try {
    const runId = workflowRunId(
      await scheduleWorkflow({ userId: input.userId, reminderId: reminder.id }),
    );
    if (runId) {
      await setOneOffReminderWorkflowRunId(input.userId, reminder.id, runId);
      reminder.workflowRunId = runId;
    }
  } catch {
    await markOneOffReminderFailed(input.userId, reminder.id);
    return {
      scheduled: false,
      reminderId: reminder.id,
      error: "Could not start reminder workflow.",
    };
  }

  return {
    scheduled: true,
    reminderId: reminder.id,
    sendAt: reminder.sendAt,
    timezone: reminder.timezone,
    kind: reminder.kind,
    message: reminder.message,
    workflowRunId: reminder.workflowRunId ?? null,
  };
}

export const scheduleOneOffReminderTool = createTool({
  id: "schedule-one-off-reminder",
  description:
    "Schedule a one-off future iMessage reminder for the user, such as a skincare follow-up next week, in a few days, or in a few hours.",
  inputSchema: z.object({
    schedule: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("relative"),
          amount: z
            .number()
            .int()
            .positive()
            .max(MAX_HORIZON_DAYS * 24 * 60),
          unit: relativeUnitSchema.describe("Use minutes, hours, days, or weeks."),
        }),
        z.object({
          type: z.literal("local_time"),
          date: z.string().describe("User-local calendar date in YYYY-MM-DD format."),
          hour: z.number().int().min(0).max(23).describe("User-local hour in 24h format."),
          minute: z.number().int().min(0).max(59).describe("User-local minute."),
        }),
      ])
      .describe(
        "Use relative for requests like 'in 3 hours' or 'next week'. Use local_time for explicit calendar dates/times.",
      ),
    kind: reminderKindSchema
      .optional()
      .describe("Reminder kind: routine_followup, skin_checkin, or custom."),
    message: z
      .string()
      .min(1)
      .max(500)
      .describe("Short user-visible iMessage reminder text to send at the scheduled time."),
  }),
  execute: async ({ schedule, kind, message }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId, timezone, scheduleOneOffReminderWorkflow } = runtime;
    if (!scheduleOneOffReminderWorkflow) {
      return { scheduled: false, error: "Reminder scheduling is unavailable." };
    }
    if (!isValidTimeZone(timezone)) {
      return {
        scheduled: false,
        needsTimezoneConfirmation: true,
        error: "Ask the user for their current city or timezone before scheduling reminders.",
      };
    }
    if (schedule.type === "local_time" && !runtime.agentContext.userAccount?.timezoneConfirmed) {
      return {
        scheduled: false,
        needsTimezoneConfirmation: true,
        error: "Ask the user for their current city or timezone before using a local date or time.",
      };
    }
    return scheduleOneOffReminder(
      { userId, timezone, schedule, kind, message },
      scheduleOneOffReminderWorkflow,
    );
  },
});

export const listOneOffRemindersTool = createTool({
  id: "list-one-off-reminders",
  description:
    "List the user's pending one-off reminders. Use this before cancelling when the target reminder ID is not already known.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    const reminders = (await listOneOffReminders(userId))
      .filter((reminder) => reminder.status === "scheduled")
      .map(({ id, sendAt, timezone, kind, message, status }) => ({
        id,
        sendAt,
        timezone,
        kind,
        message,
        status,
      }));
    return { reminders };
  },
});

export const cancelOneOffReminderTool = createTool({
  id: "cancel-one-off-reminder",
  description:
    "Cancel one pending one-off reminder that belongs to the current user. List pending reminders first if its ID is not known.",
  inputSchema: z.object({
    reminderId: z.string().min(1).describe("Exact reminder ID returned by listOneOffReminders."),
  }),
  execute: async ({ reminderId }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const reminder = await getOneOffReminder(runtime.userId, reminderId);
    if (!reminder) {
      return { cancelled: false, reminderId, message: "Pending reminder not found." };
    }
    if (reminder.status !== "scheduled") {
      return {
        cancelled: false,
        reminderId,
        status: reminder.status,
        message: `Reminder is already ${reminder.status}.`,
      };
    }

    const workflowCancelled = await cancelWorkflowRun(
      runtime.cancelOneOffReminderWorkflow,
      reminder,
    );
    const cancelled = await cancelOneOffReminder(runtime.userId, reminderId);
    if (cancelled?.status !== "cancelled") {
      return { cancelled: false, reminderId, message: "Could not cancel reminder." };
    }

    return {
      cancelled: true,
      reminderId,
      sendAt: cancelled.sendAt,
      timezone: cancelled.timezone,
      message: cancelled.message,
      workflowCancelled,
    };
  },
});
