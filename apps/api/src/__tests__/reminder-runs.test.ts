import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ReminderRunRecord } from "@skintext/db";
import type { RequestLogger } from "evlog";
import { createReminderRunManager } from "../reminder-runs";

let record: ReminderRunRecord | null;
let generations: string[];
let started: Array<{ userId: string; generation: string }>;
let deleted: Array<{ userId: string; generation?: string }>;
let cancelled: string[];
let woken: string[];
let staleRuns: ReminderRunRecord[];
let runStatuses: Map<string, string>;
let startError: Error | null;

function currentRecord(): ReminderRunRecord | null {
  return record ? { ...record } : null;
}

function createManager() {
  return createReminderRunManager({
    claimMigration: async (input) => {
      if (!record || record.runId !== input.runId || record.migrationId) return false;
      record = {
        ...record,
        generation: input.migrationId,
        migrationId: input.migrationId,
        migrationStartedAt: new Date(),
      };
      return true;
    },
    completeStart: async (input) => {
      if (
        !record ||
        record.runId !== input.expectedRunId ||
        record.generation !== input.generation
      ) {
        return false;
      }
      record = {
        ...record,
        runId: input.runId,
        deploymentId: input.deploymentId,
        generation: input.generation,
        migrationId: null,
        migrationStartedAt: null,
      };
      return true;
    },
    deleteRun: async (userId, generation) => {
      deleted.push({ userId, generation });
      if (!generation || record?.generation === generation) record = null;
    },
    getRunRecord: async () => currentRecord(),
    listStaleRuns: async () => staleRuns.map((item) => ({ ...item })),
    prepareStart: async (input) => {
      if (record) return false;
      record = {
        userId: input.userId,
        runId: `pending:${input.generation}`,
        deploymentId: input.deploymentId,
        generation: input.generation,
        migrationId: null,
        migrationStartedAt: null,
      };
      return true;
    },
    releaseMigration: async (input) => {
      if (record?.runId === input.runId && record.migrationId === input.migrationId) {
        record = { ...record, migrationId: null, migrationStartedAt: null };
      }
    },
    getWorkflowRun: (runId) => ({
      runId,
      exists: Promise.resolve(runStatuses.has(runId)),
      status: Promise.resolve(runStatuses.get(runId) ?? "completed"),
      cancel: async () => {
        cancelled.push(runId);
        runStatuses.set(runId, "cancelled");
      },
      wakeUp: async () => {
        woken.push(runId);
      },
    }),
    startWorkflow: async (userId, generation) => {
      if (startError) throw startError;
      started.push({ userId, generation });
      const runId = `run_new_${started.length}`;
      runStatuses.set(runId, "running");
      return { runId };
    },
    deploymentId: () => "deployment_new",
    generation: () => generations.shift() ?? "generation_fallback",
    now: () => new Date("2026-07-27T06:00:00.000Z"),
  });
}

describe("recurring reminder run manager", () => {
  beforeEach(() => {
    record = null;
    generations = ["generation_1", "generation_2"];
    started = [];
    deleted = [];
    cancelled = [];
    woken = [];
    staleRuns = [];
    runStatuses = new Map();
    startError = null;
  });

  test("rolls back prepared ownership when workflow startup fails", async () => {
    startError = new Error("workflow unavailable");

    await expect(createManager().start("usr_test")).rejects.toThrow("workflow unavailable");

    expect(deleted).toEqual([{ userId: "usr_test", generation: "generation_1" }]);
    expect(record).toBeNull();
  });

  test("replaces a stale deployment run with a latest-deployment run", async () => {
    record = {
      userId: "usr_test",
      runId: "run_old",
      deploymentId: "deployment_old",
      generation: null,
      migrationId: null,
      migrationStartedAt: null,
    };
    runStatuses.set("run_old", "running");

    const runId = await createManager().sync("usr_test", true);

    expect(cancelled).toEqual(["run_old"]);
    expect(started).toEqual([{ userId: "usr_test", generation: "generation_1" }]);
    expect(runId).toBe("run_new_1");
    expect(record).toMatchObject({
      runId: "run_new_1",
      deploymentId: "deployment_new",
      generation: "generation_1",
      migrationId: null,
    });
  });

  test("wakes an owned current-deployment run for an ordinary schedule change", async () => {
    record = {
      userId: "usr_test",
      runId: "run_current",
      deploymentId: "deployment_new",
      generation: "generation_current",
      migrationId: null,
      migrationStartedAt: null,
    };
    runStatuses.set("run_current", "running");

    const runId = await createManager().sync("usr_test", true);

    expect(runId).toBe("run_current");
    expect(woken).toEqual(["run_current"]);
    expect(cancelled).toEqual([]);
    expect(started).toEqual([]);
  });

  test("cancels instead of waking a recurring run when reminders are disabled", async () => {
    record = {
      userId: "usr_test",
      runId: "run_current",
      deploymentId: "deployment_new",
      generation: "generation_current",
      migrationId: null,
      migrationStartedAt: null,
    };
    runStatuses.set("run_current", "running");

    const runId = await createManager().sync("usr_test", false);

    expect(runId).toBeUndefined();
    expect(cancelled).toEqual(["run_current"]);
    expect(woken).toEqual([]);
    expect(deleted).toEqual([{ userId: "usr_test", generation: undefined }]);
    expect(record).toBeNull();
  });

  test("the deployment sweep migrates every claimed stale run", async () => {
    const oldRecord: ReminderRunRecord = {
      userId: "usr_test",
      runId: "run_old",
      deploymentId: "deployment_old",
      generation: "generation_old",
      migrationId: null,
      migrationStartedAt: null,
    };
    record = { ...oldRecord };
    staleRuns = [oldRecord];
    runStatuses.set("run_old", "running");
    const logger = { error: mock(() => undefined) } as unknown as RequestLogger;

    const result = await createManager().migrateStale(logger);

    expect(result).toEqual({ scanned: 1, migrated: 1, failed: 0, hasMore: false });
    expect(cancelled).toEqual(["run_old"]);
    expect(record?.deploymentId).toBe("deployment_new");
  });
});
