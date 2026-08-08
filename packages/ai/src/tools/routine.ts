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
  // AI Gateway function tools require a top-level JSON Schema object. A Zod
  // discriminated union serializes as a top-level oneOf, which the gateway
  // rejects before the model can answer. Keep the object root and enforce the
  // action-specific requirements during validation instead.
  inputSchema: z
    .object({
      action: z.enum(["log", "get", "delete"]),
      slot: routineSlotSchema.optional().describe("Required when action is log."),
      status: z.enum(["completed", "skipped"]).optional().describe("Required when action is log."),
      steps: z.array(routineStepSchema).max(20).optional(),
      reaction: z.string().max(500).optional(),
      notes: z.string().max(500).optional(),
      range: z.enum(["today", "seven_days"]).optional().describe("Used by get; defaults to today."),
      endDate: calendarDateSchema.optional().describe("Optional end date when getting seven days."),
      entryId: z.string().min(1).optional().describe("Required when action is delete."),
    })
    .superRefine((input, ctx) => {
      if (input.action === "log") {
        if (!input.slot) {
          ctx.addIssue({ code: "custom", path: ["slot"], message: "Required for log." });
        }
        if (!input.status) {
          ctx.addIssue({ code: "custom", path: ["status"], message: "Required for log." });
        }
      }
      if (input.action === "delete" && !input.entryId) {
        ctx.addIssue({ code: "custom", path: ["entryId"], message: "Required for delete." });
      }
    }),
  execute: async (input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { hasImage, localDate, timezone, userId } = runtime.agentContext;

    if (input.action === "log") {
      if (!input.slot || !input.status) {
        throw new Error("Validated routine log input is missing slot or status.");
      }
      const entryId = generateId("routine");
      await saveRoutineEntry({
        id: entryId,
        userId,
        slot: input.slot,
        steps: input.steps ?? [],
        completed: input.status === "completed",
        reaction: input.reaction,
        notes: input.notes,
        source: hasImage ? "photo" : "text",
        timestamp: new Date().toISOString(),
        localDate: localDateString(timezone),
      });
      return { logged: true, entryId };
    }

    if (input.action === "delete") {
      if (!input.entryId) {
        throw new Error("Validated routine delete input is missing entryId.");
      }
      const entry = await getRoutineEntry(input.entryId);
      if (!entry || entry.userId !== userId) {
        return { deleted: false, message: "Routine entry not found." };
      }
      await deleteRoutineEntry(input.entryId, userId, entry.localDate);
      return { deleted: true, entryId: input.entryId };
    }

    if (!input.range || input.range === "today") {
      const log = await getRoutineLogForDate(userId, localDate);
      return { date: localDate, entries: toolEntries(log.entries) };
    }

    const logs = await getWeeklyRoutineLogs(userId, input.endDate ?? localDate);
    return {
      days: logs.map(({ date, log }) => ({ date, entries: toolEntries(log.entries) })),
    };
  },
});
