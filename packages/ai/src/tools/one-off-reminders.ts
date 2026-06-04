import {
  createOneOffReminder,
  markOneOffReminderFailed,
  setOneOffReminderWorkflowRunId,
} from "@skintext/db";
import type { OneOffReminder, OneOffReminderKind } from "@skintext/shared";
import { generateId } from "@skintext/shared";
import { tool } from "ai";
import { z } from "zod";

const MAX_HORIZON_DAYS = 180;
const MAX_HORIZON_MS = MAX_HORIZON_DAYS * 24 * 60 * 60 * 1000;

const reminderKindSchema = z.enum(["routine_followup", "skin_checkin", "custom"]);

export interface ScheduleOneOffReminderInput {
  userId: string;
  timezone: string;
  sendAt: string;
  message: string;
  kind?: OneOffReminderKind;
}

export interface ScheduleOneOffReminderWorkflowInput {
  userId: string;
  reminderId: string;
}

export type ScheduleOneOffReminderWorkflow = (
  input: ScheduleOneOffReminderWorkflowInput,
) => Promise<{ runId?: string } | string | void>;

function workflowRunId(result: Awaited<ReturnType<ScheduleOneOffReminderWorkflow>>): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  return result.runId ?? null;
}

export async function scheduleOneOffReminder(
  input: ScheduleOneOffReminderInput,
  scheduleWorkflow: ScheduleOneOffReminderWorkflow,
  now = new Date(),
) {
  const sendAt = new Date(input.sendAt);
  const sendAtMs = sendAt.getTime();
  const nowMs = now.getTime();
  const message = input.message.trim();

  if (!Number.isFinite(sendAtMs)) {
    return { scheduled: false, error: "sendAt must be a valid ISO timestamp." };
  }

  if (sendAtMs <= nowMs) {
    return { scheduled: false, error: "sendAt must be in the future." };
  }

  if (sendAtMs - nowMs > MAX_HORIZON_MS) {
    return {
      scheduled: false,
      error: `sendAt must be within ${MAX_HORIZON_DAYS} days.`,
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

export function createScheduleOneOffReminderTool(
  scheduleWorkflow: ScheduleOneOffReminderWorkflow,
) {
  return tool({
    description:
      "Schedule a one-off future iMessage reminder for the user, such as a skincare follow-up next week, in a few days, or in a few hours. Use absolute ISO timestamps only.",
    inputSchema: z.object({
      userId: z.string(),
      timezone: z.string(),
      sendAt: z
        .string()
        .describe(
          "Absolute ISO-8601 timestamp for when to send the reminder. Convert relative user requests using the current timestamp and timezone.",
        ),
      kind: reminderKindSchema
        .optional()
        .describe("Reminder kind: routine_followup, skin_checkin, or custom."),
      message: z
        .string()
        .min(1)
        .max(500)
        .describe("Short user-visible iMessage reminder text to send at sendAt."),
    }),
    execute: async ({ userId, timezone, sendAt, kind, message }) => {
      return scheduleOneOffReminder(
        {
          userId,
          timezone,
          sendAt,
          kind,
          message,
        },
        scheduleWorkflow,
      );
    },
  });
}
