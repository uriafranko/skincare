import { describe, expect, mock, test } from "bun:test";

const hashStore: Record<string, Record<string, unknown>> = {};
const zsetStore: Record<string, { score: number; member: string }[]> = {};

const mockRedis = {
  hset: mock((key: string, value: Record<string, unknown>) => {
    hashStore[key] = { ...(hashStore[key] ?? {}), ...value };
    return Promise.resolve(1);
  }),
  hgetall: mock((key: string) => Promise.resolve(hashStore[key] ?? null)),
  del: mock((key: string) => {
    delete hashStore[key];
    delete zsetStore[key];
    return Promise.resolve(1);
  }),
  zadd: mock((key: string, entry: { score: number; member: string }) => {
    if (!zsetStore[key]) zsetStore[key] = [];
    zsetStore[key].push(entry);
    zsetStore[key].sort((a, b) => a.score - b.score);
    return Promise.resolve(1);
  }),
  zrange: mock((key: string) => Promise.resolve((zsetStore[key] ?? []).map((e) => e.member))),
  zrem: mock((key: string, member: string) => {
    zsetStore[key] = (zsetStore[key] ?? []).filter((e) => e.member !== member);
    return Promise.resolve(1);
  }),
  pipeline: () => {
    const ops: (() => Promise<unknown>)[] = [];
    const p = {
      hset(key: string, value: Record<string, unknown>) {
        ops.push(() => mockRedis.hset(key, value));
        return p;
      },
      hgetall(key: string) {
        ops.push(() => mockRedis.hgetall(key));
        return p;
      },
      del(key: string) {
        ops.push(() => mockRedis.del(key));
        return p;
      },
      zadd(key: string, entry: { score: number; member: string }) {
        ops.push(() => mockRedis.zadd(key, entry));
        return p;
      },
      zrem(key: string, member: string) {
        ops.push(() => mockRedis.zrem(key, member));
        return p;
      },
      exec: () => Promise.all(ops.map((fn) => fn())),
    };
    return p;
  },
};

mock.module("../client", () => ({
  getRedis: () => mockRedis,
}));

mock.module("@skintext/shared", () => ({
  encryptContent: async (s: string) => `enc:${s}`,
  decrypt: async (s: string) => s.replace(/^enc:/, ""),
}));

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
    const logs = await getWeeklyRoutineLogs("usr_test", "2026-06-04");
    expect(logs).toHaveLength(7);
    expect(logs[0]!.date).toBe("2026-05-29");
    expect(logs[6]!.date).toBe("2026-06-04");
  });

  test("delete removes an entry from the daily index", async () => {
    await deleteRoutineEntry("routine_1", "usr_test", "2026-06-04");
    const log = await getRoutineLogForDate("usr_test", "2026-06-04");
    expect(log.entryCount).toBe(0);
  });
});
