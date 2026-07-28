import { createTool } from "@mastra/core/tools";
import {
  deleteCustomReminderTimes,
  getCustomReminderTimes,
  setCustomReminderTimes,
  updateUser,
} from "@skintext/db";
import { isValidTimeZone, localDateString } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

export const setTimezoneTool = createTool({
  id: "set-operational-timezone",
  description:
    "Persist a user-confirmed IANA timezone when their stated city or timezone changes. Use this because local routine dates and reminder delivery are operational effects, not only conversational memory.",
  inputSchema: z.object({
    timezone: z
      .string()
      .describe(
        "Valid IANA timezone derived from a city or timezone explicitly stated by the user, e.g. America/New_York.",
      ),
  }),
  execute: async ({ timezone }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId } = runtime.agentContext;
    if (!isValidTimeZone(timezone)) {
      return {
        updated: false,
        message: "Timezone must be a valid IANA timezone derived from the user's stated location.",
      };
    }

    await updateUser(userId, {
      timezone,
      timezoneConfirmed: "true",
    });
    runtime.agentContext.timezone = timezone;
    runtime.agentContext.localDate = localDateString(timezone);
    if (runtime.agentContext.userAccount) {
      runtime.agentContext.userAccount.timezone = timezone;
      runtime.agentContext.userAccount.timezoneConfirmed = true;
    }

    let recurringRemindersResynced = false;
    if (runtime.syncRecurringReminderSchedule) {
      const reminders = await getCustomReminderTimes(userId);
      if (reminders?.length) {
        await runtime.syncRecurringReminderSchedule({ userId, enabled: true });
        recurringRemindersResynced = true;
      }
    }

    return {
      updated: true,
      timezone,
      timezoneConfirmed: true,
      recurringRemindersResynced,
    };
  },
});

export const setRemindersTool = createTool({
  id: "set-reminders",
  description:
    "Replace the full opt-in recurring skincare routine reminder schedule. For changes to an existing schedule, call getReminders first and include unchanged slots unless the user explicitly removes them.",
  inputSchema: z.object({
    enabled: z.boolean().optional().describe("Set false to turn off recurring routine reminders."),
    times: z
      .array(
        z.object({
          label: z
            .string()
            .min(1)
            .max(40)
            .describe("Routine label, e.g. 'morning', 'evening', or 'custom'"),
          hour: z.number().min(0).max(23).describe("Hour in 24h format"),
          minute: z.number().min(0).max(59).describe("Minute"),
        }),
      )
      .max(4)
      .describe(
        "The complete desired reminder schedule in the user's local timezone, with at most four times. Use an empty array to turn reminders off.",
      ),
  }),
  execute: async ({ enabled = true, times }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { syncRecurringReminderSchedule } = runtime;
    const { timezone, userId } = runtime.agentContext;
    const shouldEnable = enabled && times.length > 0;

    if (
      shouldEnable &&
      (!runtime.agentContext.userAccount?.timezoneConfirmed || !isValidTimeZone(timezone))
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

    const runId =
      (await syncRecurringReminderSchedule?.({ userId, enabled: shouldEnable })) ?? null;
    const schedule = times.map(
      (t) => `${t.label}: ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    );

    return shouldEnable
      ? {
          updated: true,
          enabled: true,
          schedule,
          timezone,
          workflowRunId: runId,
        }
      : {
          updated: true,
          enabled: false,
          schedule: [],
          timezone,
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
    const { timezone, userId } = runtime.agentContext;
    const custom = await getCustomReminderTimes(userId);
    if (!custom) {
      return {
        enabled: false,
        schedule: [],
        timezone,
        timezoneConfirmed: runtime.agentContext.userAccount?.timezoneConfirmed === true,
      };
    }
    return {
      enabled: custom.length > 0,
      schedule: custom,
      timezone,
      timezoneConfirmed: runtime.agentContext.userAccount?.timezoneConfirmed === true,
    };
  },
});
