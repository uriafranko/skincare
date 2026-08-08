import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () => createSharedMock());

const {
  deleteRoutineEntry,
  getRoutineEntry,
  getRoutineLogForDate,
  getWeeklyRoutineLogs,
  saveRoutineEntry,
} = await import("../routine-log");

describe("routine logs", () => {
  test("saves and retrieves a routine entry", async () => {
    await saveRoutineEntry({
      id: "routine_1",
      userId: "usr_test",
      slot: "morning",
      completed: true,
      steps: [{ name: "moisturize", productName: "Barrier Cream" }],
      reaction: "none",
      source: "text",
      timestamp: "2026-06-04T07:00:00.000Z",
      localDate: "2026-06-04",
    });

    const entry = await getRoutineEntry("routine_1");
    expect(entry?.slot).toBe("morning");
    expect(entry?.steps[0]?.productName).toBe("Barrier Cream");
  });

  test("daily log summarizes completed slots and products", async () => {
    const log = await getRoutineLogForDate("usr_test", "2026-06-04");
    expect(log.entryCount).toBe(1);
    expect(log.completedSlots).toContain("morning");
    expect(log.productsUsed).toContain("Barrier Cream");
  });

  test("weekly logs return seven dates", async () => {
    await saveRoutineEntry({
      id: "routine_outside_week",
      userId: "usr_test",
      slot: "evening",
      completed: true,
      steps: [{ name: "cleanse", productName: "Old Cleanser" }],
      source: "text",
      timestamp: "2026-05-28T19:00:00.000Z",
      localDate: "2026-05-28",
    });
    await saveRoutineEntry({
      id: "routine_other_user",
      userId: "usr_other",
      slot: "evening",
      completed: true,
      steps: [{ name: "cleanse", productName: "Other Cleanser" }],
      source: "text",
      timestamp: "2026-06-03T19:00:00.000Z",
      localDate: "2026-06-03",
    });

    const logs = await getWeeklyRoutineLogs("usr_test", "2026-06-04");
    expect(logs).toHaveLength(7);
    expect(logs[0]!.date).toBe("2026-05-29");
    expect(logs[6]!.date).toBe("2026-06-04");
    expect(logs[0]!.log.entryCount).toBe(0);
    expect(logs[5]!.log.entryCount).toBe(0);
    expect(logs[6]!.log.entryCount).toBe(1);
    expect(logs.flatMap(({ log }) => log.productsUsed)).toEqual(["Barrier Cream"]);
  });

  test("delete removes an entry from the daily index", async () => {
    await deleteRoutineEntry("routine_1", "usr_test", "2026-06-04");
    const log = await getRoutineLogForDate("usr_test", "2026-06-04");
    expect(log.entryCount).toBe(0);
  });
});
