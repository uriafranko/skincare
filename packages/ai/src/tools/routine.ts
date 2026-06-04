import {
  deleteRoutineEntry,
  getRoutineEntry,
  getRoutineLogForDate,
  getWeeklyRoutineLogs,
  saveRoutineEntry,
} from "@skintext/db";
import { localDateString } from "@skintext/shared";
import { tool } from "ai";
import { z } from "zod";
import { routineSlotSchema, routineStepSchema } from "./schemas";

export const logRoutineStepTool = tool({
  description:
    "Log skincare routine completion, product use, skipped steps, or reactions for today.",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
    slot: routineSlotSchema,
    steps: z.array(routineStepSchema).describe("Steps or products used in this routine log"),
    completed: z.boolean().describe("True if the routine slot was completed"),
    reaction: z
      .string()
      .optional()
      .describe("Any irritation, dryness, breakout, or other reaction"),
    notes: z.string().optional().describe("Short user-facing note about this log"),
    source: z.enum(["photo", "text", "manual"]),
  }),
  execute: async ({ userId, timezone, slot, steps, completed, reaction, notes, source }) => {
    const localDate = localDateString(timezone);
    const id = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await saveRoutineEntry({
      id,
      userId,
      slot,
      steps,
      completed,
      reaction,
      notes,
      source,
      timestamp: new Date().toISOString(),
      localDate,
    });

    return {
      logged: true,
      entryId: id,
      slot,
      completed,
      stepCount: steps.length,
      productsUsed: steps.map((s) => s.productName).filter(Boolean),
      reaction: reaction ?? null,
      localDate,
    };
  },
});

export const deleteRoutineEntryTool = tool({
  description: "Delete a previously logged skincare routine entry.",
  inputSchema: z.object({
    userId: z.string(),
    entryId: z.string().describe("Routine entry ID to delete"),
  }),
  execute: async ({ userId, entryId }) => {
    const entry = await getRoutineEntry(entryId);
    if (!entry || entry.userId !== userId) {
      return { deleted: false, message: "Routine entry not found." };
    }

    await deleteRoutineEntry(entryId, userId, entry.localDate);
    return {
      deleted: true,
      entryId,
      slot: entry.slot,
      localDate: entry.localDate,
      stepCount: entry.steps.length,
    };
  },
});

export const getTodayRoutineLogTool = tool({
  description:
    "Get today's skincare routine log. Always returns TODAY's routine data -- no date parameter needed.",
  inputSchema: z.object({
    userId: z.string(),
    localDate: z.string(),
  }),
  execute: async ({ userId, localDate }) => {
    return await getRoutineLogForDate(userId, localDate);
  },
});

export const getWeeklyRoutineLogTool = tool({
  description: "Get the past 7 days of skincare routine logs for summaries and trends.",
  inputSchema: z.object({
    userId: z.string(),
    endDate: z.string().describe("The end date in YYYY-MM-DD format"),
  }),
  execute: async ({ userId, endDate }) => {
    return await getWeeklyRoutineLogs(userId, endDate);
  },
});
