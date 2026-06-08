import {
  deleteCustomReminderTimes,
  getCustomReminderTimes,
  setCustomReminderTimes,
} from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

export type RecurringReminderScheduleSync = (input: {
  userId: string;
  enabled: boolean;
}) => Promise<{ runId?: string } | string | undefined>;

function workflowRunId(result: Awaited<ReturnType<RecurringReminderScheduleSync>>): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  return result.runId ?? null;
}

export function createSetRemindersTool(syncSchedule?: RecurringReminderScheduleSync) {
  return tool({
    description:
      "Replace the full opt-in recurring skincare routine reminder schedule. For changes to an existing schedule, call getReminders first and include unchanged slots unless the user explicitly removes them.",
    inputSchema: z.object({
      userId: z.string(),
      enabled: z
        .boolean()
        .optional()
        .describe("Set false to turn off recurring routine reminders."),
      times: z
        .array(
          z.object({
            label: z.string().describe("Routine label, e.g. 'morning', 'evening', or 'custom'"),
            hour: z.number().min(0).max(23).describe("Hour in 24h format"),
            minute: z.number().min(0).max(59).describe("Minute"),
          }),
        )
        .describe(
          "The complete desired reminder schedule in the user's local timezone. Use an empty array to turn reminders off.",
        ),
    }),
    execute: async ({ userId, enabled = true, times }) => {
      const shouldEnable = enabled && times.length > 0;

      if (shouldEnable) {
        await setCustomReminderTimes(userId, times);
      } else {
        await deleteCustomReminderTimes(userId);
      }

      const runId = workflowRunId(await syncSchedule?.({ userId, enabled: shouldEnable }));
      const schedule = times.map(
        (t) =>
          `${t.label}: ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
      );

      return shouldEnable
        ? { updated: true, enabled: true, schedule, workflowRunId: runId }
        : { updated: true, enabled: false, schedule: [], workflowRunId: runId };
    },
  });
}

export const setRemindersTool = createSetRemindersTool();

export const getRemindersTool = tool({
  description: "Get the user's current reminder schedule.",
  inputSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    const custom = await getCustomReminderTimes(userId);
    if (!custom) {
      return {
        enabled: false,
        schedule: [],
      };
    }
    return { enabled: custom.length > 0, schedule: custom };
  },
});
