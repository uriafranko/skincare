import { getCustomReminderTimes, setCustomReminderTimes } from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

export const setRemindersTool = tool({
  description:
    "Set custom skincare routine reminder times for the user. Replaces the default morning and evening routine schedule.",
  inputSchema: z.object({
    userId: z.string(),
    times: z.array(
      z.object({
        label: z.string().describe("Routine label, e.g. 'morning', 'evening', or 'custom'"),
        hour: z.number().min(0).max(23).describe("Hour in 24h format"),
        minute: z.number().min(0).max(59).describe("Minute"),
      }),
    ),
  }),
  execute: async ({ userId, times }) => {
    await setCustomReminderTimes(userId, times);
    const schedule = times.map(
      (t) => `${t.label}: ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`,
    );
    return { updated: true, schedule };
  },
});

export const getRemindersTool = tool({
  description: "Get the user's current reminder schedule.",
  inputSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    const custom = await getCustomReminderTimes(userId);
    if (!custom) {
      return {
        isCustom: false,
        schedule: [
          { label: "morning", hour: 8, minute: 0 },
          { label: "evening", hour: 21, minute: 0 },
        ],
      };
    }
    return { isCustom: true, schedule: custom };
  },
});
