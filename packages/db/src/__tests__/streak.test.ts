import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { getAdherenceStreak, updateAdherenceStreak } = await import("../streak");

describe("adherence streak", () => {
  test("starts empty", async () => {
    const streak = await getAdherenceStreak("usr_test");
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
  });

  test("increments on consecutive dates", async () => {
    await updateAdherenceStreak("usr_test", "2026-06-03");
    const streak = await updateAdherenceStreak("usr_test", "2026-06-04");
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
  });

  test("does not double-count same date", async () => {
    const streak = await updateAdherenceStreak("usr_test", "2026-06-04");
    expect(streak.current).toBe(2);
  });
});
