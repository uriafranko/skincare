import { createTool } from "@mastra/core/tools";
import {
  deleteCustomReminderTimes,
  getCustomReminderTimes,
  setCustomReminderTimes,
} from "@skintext/db";
import { isValidTimeZone } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime, type RecurringReminderScheduleSync } from "../runtime";

function workflowRunId(result: Awaited<ReturnType<RecurringReminderScheduleSync>>): string | null {
  if (!result) return null;
  if (typeof result === "string") return result;
  return result.runId ?? null;
}

export const setRemindersTool = createTool({
  id: "set-reminders",
  description:
    "Replace the full opt-in recurring skincare routine reminder schedule. For changes to an existing schedule, call getReminders first and include unchanged slots unless the user explicitly removes them.",
  inputSchema: z.object({
    enabled: z.boolean().optional().describe("Set false to turn off recurring routine reminders."),
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
  execute: async ({ enabled = true, times }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId, syncRecurringReminderSchedule } = runtime;
    const shouldEnable = enabled && times.length > 0;

    if (
      shouldEnable &&
      (!runtime.agentContext.userProfile?.timezoneConfirmed || !isValidTimeZone(runtime.timezone))
    ) {
      return {
        updated: false,
        enabled: false,
        needsTimezoneConfirmation: true,
        message:
          "Ask the user for their current city or timezone before setting local-time reminders.",
      };
    }

    if (shouldEnable) {
      await setCustomReminderTimes(userId, times);
    } else {
      await deleteCustomReminderTimes(userId);
    }

    const runId = workflowRunId(
      await syncRecurringReminderSchedule?.({ userId, enabled: shouldEnable }),
    );
    const schedule = times.map(
      (t) => `${t.label}: ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    );

    return shouldEnable
      ? {
          updated: true,
          enabled: true,
          schedule,
          timezone: runtime.timezone,
          workflowRunId: runId,
        }
      : {
          updated: true,
          enabled: false,
          schedule: [],
          timezone: runtime.timezone,
          workflowRunId: runId,
        };
  },
});

export const getRemindersTool = createTool({
  id: "get-reminders",
  description: "Get the user's current reminder schedule.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId } = runtime;
    const custom = await getCustomReminderTimes(userId);
    if (!custom) {
      return {
        enabled: false,
        schedule: [],
        timezone: runtime.timezone,
        timezoneConfirmed: runtime.agentContext.userProfile?.timezoneConfirmed === true,
      };
    }
    return {
      enabled: custom.length > 0,
      schedule: custom,
      timezone: runtime.timezone,
      timezoneConfirmed: runtime.agentContext.userProfile?.timezoneConfirmed === true,
    };
  },
});
