import { createTool } from "@mastra/core/tools";
import {
  deleteRoutineEntry,
  getRoutineEntry,
  getRoutineLogForDate,
  getWeeklyRoutineLogs,
  saveRoutineEntry,
} from "@skintext/db";
import { localDateString } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";
import { routineSlotSchema, routineStepSchema } from "./schemas";

export const logRoutineStepTool = createTool({
  id: "log-routine-step",
  description:
    "Log skincare routine completion, product use, skipped steps, or reactions for today.",
  inputSchema: z.object({
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
  execute: async ({ slot, steps, completed, reaction, notes, source }, context) => {
    const { userId, timezone } = getSkintextRuntime(context.requestContext);
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

export const deleteRoutineEntryTool = createTool({
  id: "delete-routine-entry",
  description: "Delete a previously logged skincare routine entry.",
  inputSchema: z.object({
    entryId: z.string().describe("Routine entry ID to delete"),
  }),
  execute: async ({ entryId }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
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

export const getTodayRoutineLogTool = createTool({
  id: "get-today-routine-log",
  description:
    "Get today's skincare routine log. Always returns TODAY's routine data -- no date parameter needed.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { userId, agentContext } = getSkintextRuntime(context.requestContext);
    const { localDate } = agentContext;
    return await getRoutineLogForDate(userId, localDate);
  },
});

export const getWeeklyRoutineLogTool = createTool({
  id: "get-weekly-routine-log",
  description: "Get the past 7 days of skincare routine logs for summaries and trends.",
  inputSchema: z.object({
    endDate: z.string().describe("The end date in YYYY-MM-DD format"),
  }),
  execute: async ({ endDate }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    return await getWeeklyRoutineLogs(userId, endDate);
  },
});
