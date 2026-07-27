import {
  claimReminderRunMigration,
  completeReminderRunStart,
  deleteReminderRunId,
  getReminderRun,
  listReminderRunsNeedingMigration,
  prepareReminderRunStart,
  type ReminderRunRecord,
  releaseReminderRunMigration,
} from "@skintext/db";
import type { RequestLogger } from "evlog";
import { getRun, start } from "workflow/api";
import { reminderLoop } from "../workflows/reminder-loop";

const ACTIVE_RUN_STATUSES = new Set(["pending", "running"]);
const MIGRATION_LEASE_MS = 5 * 60 * 1000;
const MIGRATION_BATCH_SIZE = 100;
const MIGRATION_CONCURRENCY = 10;

type ManagedRun = {
  runId: string;
  exists: Promise<boolean>;
  status: Promise<string>;
  cancel(): Promise<void>;
  wakeUp(): Promise<unknown>;
};

type ReminderRunManagerDeps = {
  claimMigration: typeof claimReminderRunMigration;
  completeStart: typeof completeReminderRunStart;
  deleteRun: typeof deleteReminderRunId;
  getRunRecord: typeof getReminderRun;
  listStaleRuns: typeof listReminderRunsNeedingMigration;
  prepareStart: typeof prepareReminderRunStart;
  releaseMigration: typeof releaseReminderRunMigration;
  getWorkflowRun(runId: string): ManagedRun;
  startWorkflow(userId: string, generation: string): Promise<{ runId: string }>;
  deploymentId(): string;
  generation(): string;
  now(): Date;
};

function productionDeploymentId(): string {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (deploymentId) return deploymentId;

  if (process.env.NODE_ENV === "production") {
    throw new Error("VERCEL_DEPLOYMENT_ID is required to migrate recurring reminder workflows");
  }

  return "local-development";
}

const defaultDeps: ReminderRunManagerDeps = {
  claimMigration: claimReminderRunMigration,
  completeStart: completeReminderRunStart,
  deleteRun: deleteReminderRunId,
  getRunRecord: getReminderRun,
  listStaleRuns: listReminderRunsNeedingMigration,
  prepareStart: prepareReminderRunStart,
  releaseMigration: releaseReminderRunMigration,
  getWorkflowRun: (runId) => getRun(runId),
  startWorkflow: async (userId, generation) => {
    const run = await start(reminderLoop, [userId, generation], {
      deploymentId: "latest",
    });
    return { runId: run.runId };
  },
  deploymentId: productionDeploymentId,
  generation: () => crypto.randomUUID(),
  now: () => new Date(),
};

async function inBatches<T>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < values.length; index += concurrency) {
    await Promise.all(values.slice(index, index + concurrency).map(fn));
  }
}

export function createReminderRunManager(deps: ReminderRunManagerDeps = defaultDeps) {
  async function cancelIfActive(runId: string): Promise<void> {
    if (runId.startsWith("pending:")) return;
    const run = deps.getWorkflowRun(runId);
    if (!(await run.exists)) return;
    if (ACTIVE_RUN_STATUSES.has(await run.status)) await run.cancel();
  }

  async function startFresh(userId: string): Promise<string | undefined> {
    const deploymentId = deps.deploymentId();
    const generation = deps.generation();
    const pendingRunId = `pending:${generation}`;
    const prepared = await deps.prepareStart({ userId, deploymentId, generation });
    if (!prepared) return (await deps.getRunRecord(userId))?.runId;

    let newRunId: string | undefined;
    try {
      const run = await deps.startWorkflow(userId, generation);
      newRunId = run.runId;
      const completed = await deps.completeStart({
        userId,
        expectedRunId: pendingRunId,
        deploymentId,
        generation,
        runId: run.runId,
      });
      if (!completed) {
        await cancelIfActive(run.runId);
        return (await deps.getRunRecord(userId))?.runId;
      }
      return run.runId;
    } catch (error) {
      if (newRunId) await cancelIfActive(newRunId).catch(() => undefined);
      await deps.deleteRun(userId, generation);
      throw error;
    }
  }

  async function migrate(record: ReminderRunRecord): Promise<string | undefined> {
    const deploymentId = deps.deploymentId();
    const migrationId = deps.generation();
    const claimed = await deps.claimMigration({
      userId: record.userId,
      runId: record.runId,
      deploymentId,
      migrationId,
      leaseExpiredBefore: new Date(deps.now().getTime() - MIGRATION_LEASE_MS),
    });
    if (!claimed) return (await deps.getRunRecord(record.userId))?.runId;

    let newRunId: string | undefined;
    try {
      await cancelIfActive(record.runId);
      const run = await deps.startWorkflow(record.userId, migrationId);
      newRunId = run.runId;
      const completed = await deps.completeStart({
        userId: record.userId,
        expectedRunId: record.runId,
        deploymentId,
        generation: migrationId,
        runId: run.runId,
      });
      if (!completed) {
        await cancelIfActive(run.runId);
        return (await deps.getRunRecord(record.userId))?.runId;
      }
      return run.runId;
    } catch (error) {
      if (newRunId) await cancelIfActive(newRunId).catch(() => undefined);
      await deps.releaseMigration({
        userId: record.userId,
        runId: record.runId,
        migrationId,
      });
      throw error;
    }
  }

  return {
    async start(userId: string): Promise<string | undefined> {
      return startFresh(userId);
    },

    async sync(userId: string, enabled: boolean): Promise<string | undefined> {
      const existing = await deps.getRunRecord(userId);

      if (!enabled) {
        if (existing) await cancelIfActive(existing.runId);
        await deps.deleteRun(userId);
        return undefined;
      }

      if (!existing) return startFresh(userId);

      const deploymentId = deps.deploymentId();
      const isCurrent =
        existing.deploymentId === deploymentId &&
        !!existing.generation &&
        !existing.migrationId &&
        !existing.runId.startsWith("pending:");

      if (!isCurrent) return migrate(existing);

      const run = deps.getWorkflowRun(existing.runId);
      if ((await run.exists) && ACTIVE_RUN_STATUSES.has(await run.status)) {
        await run.wakeUp();
        return existing.runId;
      }

      await deps.deleteRun(userId, existing.generation ?? undefined);
      return startFresh(userId);
    },

    async migrateStale(log: RequestLogger): Promise<{
      scanned: number;
      migrated: number;
      failed: number;
      hasMore: boolean;
    }> {
      const deploymentId = deps.deploymentId();
      const records = await deps.listStaleRuns(deploymentId, MIGRATION_BATCH_SIZE);
      let migrated = 0;
      let failed = 0;

      await inBatches(records, MIGRATION_CONCURRENCY, async (record) => {
        try {
          const before = record.runId;
          const after = await migrate(record);
          if (after && after !== before) migrated++;
        } catch (error) {
          failed++;
          log.error(error as Error);
        }
      });

      return {
        scanned: records.length,
        migrated,
        failed,
        hasMore: records.length === MIGRATION_BATCH_SIZE,
      };
    },
  };
}

export const reminderRunManager = createReminderRunManager();
