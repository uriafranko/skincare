import type {
  RoutineExperiment,
  RoutineExperimentOutcome,
  RoutineExperimentStatus,
} from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { routineExperiments } from "./schema";

async function encodeExperiment(experiment: RoutineExperiment): Promise<string> {
  return encryptContent(JSON.stringify(experiment));
}

async function decodeExperiment(value: string): Promise<RoutineExperiment> {
  return JSON.parse(await decrypt(value)) as RoutineExperiment;
}

export async function getActiveRoutineExperiment(
  userId: string,
): Promise<RoutineExperiment | null> {
  const row = await getDb().query.routineExperiments.findFirst({
    where: and(eq(routineExperiments.userId, userId), eq(routineExperiments.status, "active")),
  });
  return row ? decodeExperiment(row.value) : null;
}

export async function getRoutineExperiment(
  userId: string,
  experimentId: string,
): Promise<RoutineExperiment | null> {
  const row = await getDb().query.routineExperiments.findFirst({
    where: and(eq(routineExperiments.userId, userId), eq(routineExperiments.id, experimentId)),
  });
  return row ? decodeExperiment(row.value) : null;
}

export async function listRoutineExperiments(
  userId: string,
  limit = 10,
): Promise<RoutineExperiment[]> {
  const rows = await getDb().query.routineExperiments.findMany({
    where: eq(routineExperiments.userId, userId),
  });
  const experiments: RoutineExperiment[] = [];
  for (const row of rows) experiments.push(await decodeExperiment(row.value));
  return experiments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function saveRoutineExperiment(experiment: RoutineExperiment): Promise<void> {
  const value = await encodeExperiment(experiment);
  await getDb()
    .insert(routineExperiments)
    .values({
      id: experiment.id,
      userId: experiment.userId,
      status: experiment.status,
      reviewAt: experiment.plannedReviewAt ?? null,
      value,
      createdAt: experiment.createdAt,
    })
    .onConflictDoUpdate({
      target: routineExperiments.id,
      set: {
        status: experiment.status,
        reviewAt: experiment.plannedReviewAt ?? null,
        value,
        updatedAt: sql`now()`,
      },
    });
}

export async function createRoutineExperiment(experiment: RoutineExperiment): Promise<
  | { created: true; experiment: RoutineExperiment }
  | {
      created: false;
      experiment: RoutineExperiment;
    }
> {
  const active = await getActiveRoutineExperiment(experiment.userId);
  if (active) return { created: false, experiment: active };
  try {
    await saveRoutineExperiment(experiment);
  } catch (error) {
    const conflict =
      (error as { code?: string } | undefined)?.code === "23505" ||
      String(error).includes("routine_experiments_one_active_user_idx");
    if (!conflict) throw error;
    const concurrentActive = await getActiveRoutineExperiment(experiment.userId);
    if (concurrentActive) return { created: false, experiment: concurrentActive };
    throw error;
  }
  return { created: true, experiment };
}

export async function closeRoutineExperiment(
  userId: string,
  experimentId: string,
  input: {
    status: Exclude<RoutineExperimentStatus, "active">;
    outcome?: RoutineExperimentOutcome;
    outcomeNotes?: string;
  },
): Promise<RoutineExperiment | null> {
  const existing = await getRoutineExperiment(userId, experimentId);
  if (!existing) return null;
  const updated: RoutineExperiment = {
    ...existing,
    status: input.status,
    outcome: input.outcome,
    outcomeNotes: input.outcomeNotes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  await saveRoutineExperiment(updated);
  return updated;
}

export async function deleteAllRoutineExperiments(userId: string): Promise<void> {
  await getDb().delete(routineExperiments).where(eq(routineExperiments.userId, userId));
}
