import { createTool } from "@mastra/core/tools";
import {
  deleteRoutineEntry,
  getRoutineEntry,
  getRoutineLogForDate,
  getWeeklyRoutineLogs,
  saveRoutineEntry,
} from "@skintext/db";
import { generateId, localDateString, type RoutineLogEntry } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";
import { calendarDateSchema, routineSlotSchema, routineStepSchema } from "./schemas";

function toolEntries(entries: RoutineLogEntry[]) {
  return entries.map(({ id, slot, steps, completed, reaction, notes }) => ({
    id,
    slot,
    steps,
    status: completed ? ("completed" as const) : ("skipped" as const),
    ...(reaction ? { reaction } : {}),
    ...(notes ? { notes } : {}),
  }));
}

export const routineTool = createTool({
  id: "routine",
  description: "Log, read, or delete verified skincare routine entries.",
  inputSchema: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("log"),
      slot: routineSlotSchema,
      status: z.enum(["completed", "skipped"]),
      steps: z.array(routineStepSchema).max(20).default([]),
      reaction: z.string().max(500).optional(),
      notes: z.string().max(500).optional(),
    }),
    z.object({
      action: z.literal("get"),
      range: z.enum(["today", "seven_days"]),
      endDate: calendarDateSchema.optional(),
    }),
    z.object({
      action: z.literal("delete"),
      entryId: z.string(),
    }),
  ]),
  execute: async (input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId, timezone } = runtime;

    if (input.action === "log") {
      const entryId = generateId("routine");
      await saveRoutineEntry({
        id: entryId,
        userId,
        slot: input.slot,
        steps: input.steps,
        completed: input.status === "completed",
        reaction: input.reaction,
        notes: input.notes,
        source: runtime.hasImage ? "photo" : "text",
        timestamp: new Date().toISOString(),
        localDate: localDateString(timezone),
      });
      return { logged: true, entryId };
    }

    if (input.action === "delete") {
      const entry = await getRoutineEntry(input.entryId);
      if (!entry || entry.userId !== userId) {
        return { deleted: false, message: "Routine entry not found." };
      }
      await deleteRoutineEntry(input.entryId, userId, entry.localDate);
      return { deleted: true, entryId: input.entryId };
    }

    const localDate = runtime.agentContext.localDate;
    if (input.range === "today") {
      const log = await getRoutineLogForDate(userId, localDate);
      return { date: localDate, entries: toolEntries(log.entries) };
    }

    const logs = await getWeeklyRoutineLogs(userId, input.endDate ?? localDate);
    return {
      days: logs.map(({ date, log }) => ({ date, entries: toolEntries(log.entries) })),
    };
  },
});
