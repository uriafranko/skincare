import { beforeEach, describe, expect, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import type { z } from "zod";
import {
  deleteRoutineEntry,
  getRoutineEntry,
  getRoutineLogForDate,
  getWeeklyRoutineLogs,
  saveRoutineEntry,
} from "./db-mock";

const { routineTool } = await import("../tools/routine");

function execute(input: Record<string, unknown>, runtime: Record<string, unknown> = {}) {
  if (!routineTool.execute) throw new Error("Tool is not executable.");
  const requestContext = new RequestContext();
  const { agentContext, ...runtimeServices } = runtime;
  requestContext.set("runtime", {
    agentContext: {
      userId: "usr_routine",
      timezone: "Asia/Jerusalem",
      hasImage: false,
      localDate: "2026-07-27",
      ...(agentContext as Record<string, unknown> | undefined),
    },
    ...runtimeServices,
  });
  return routineTool.execute(input as never, { requestContext } as never);
}

describe("routineTool", () => {
  beforeEach(() => {
    deleteRoutineEntry.mockClear();
    getRoutineEntry.mockClear();
    getRoutineLogForDate.mockClear();
    getWeeklyRoutineLogs.mockClear();
    saveRoutineEntry.mockClear();
  });

  test("validates action-specific required fields", () => {
    const inputSchema = routineTool.inputSchema as z.ZodType;
    expect(inputSchema.safeParse({ action: "log" }).success).toBe(false);
    expect(inputSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(
      inputSchema.safeParse({
        action: "log",
        slot: "morning",
        status: "completed",
      }).success,
    ).toBe(true);
    expect(inputSchema.safeParse({ action: "delete", entryId: "routine_1" }).success).toBe(true);
  });

  test("reads today's entries", async () => {
    await execute({ action: "get", range: "today" });

    expect(getRoutineLogForDate).toHaveBeenCalledWith("usr_routine", "2026-07-27");
    expect(getWeeklyRoutineLogs).not.toHaveBeenCalled();
  });

  test("reads a seven-day range ending on the requested date", async () => {
    await execute({ action: "get", range: "seven_days", endDate: "2026-07-20" });

    expect(getWeeklyRoutineLogs).toHaveBeenCalledWith("usr_routine", "2026-07-20");
  });

  test("returns only useful entry fields", async () => {
    getRoutineLogForDate.mockResolvedValueOnce({
      entries: [
        {
          id: "routine_1",
          userId: "usr_routine",
          slot: "morning",
          steps: [{ name: "cleanse", productName: "Gentle Cleanser" }],
          completed: true,
          source: "text",
          timestamp: "2026-07-27T07:00:00.000Z",
          localDate: "2026-07-27",
        },
      ],
      entryCount: 1,
      completedSlots: ["morning"],
      productsUsed: ["Gentle Cleanser"],
      reactions: [],
    });

    const result = await execute({ action: "get", range: "today" });

    expect(result).toEqual({
      date: "2026-07-27",
      entries: [
        {
          id: "routine_1",
          slot: "morning",
          steps: [{ name: "cleanse", productName: "Gentle Cleanser" }],
          status: "completed",
        },
      ],
    });
  });

  test("logs an action using trusted runtime context", async () => {
    await execute(
      {
        action: "log",
        slot: "morning",
        status: "completed",
        steps: [{ name: "cleanse", productName: "Gentle Cleanser" }],
      },
      { agentContext: { hasImage: true } },
    );

    expect(saveRoutineEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_routine",
        completed: true,
        source: "photo",
      }),
    );
  });

  test("deletes only the current user's entry", async () => {
    getRoutineEntry.mockResolvedValueOnce({
      id: "routine_1",
      userId: "usr_routine",
      localDate: "2026-07-27",
    });

    const result = await execute({ action: "delete", entryId: "routine_1" });

    expect(deleteRoutineEntry).toHaveBeenCalledWith("routine_1", "usr_routine", "2026-07-27");
    expect(result).toEqual({ deleted: true, entryId: "routine_1" });
  });
});
