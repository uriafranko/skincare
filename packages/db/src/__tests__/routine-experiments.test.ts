import { describe, expect, mock, test } from "bun:test";
import type { RoutineExperiment } from "@skintext/shared";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));
mock.module("@skintext/shared", () => createSharedMock());

const {
  closeRoutineExperiment,
  createRoutineExperiment,
  getActiveRoutineExperiment,
  listRoutineExperiments,
} = await import("../routine-experiments");
const { routineExperiments } = await import("../schema");

function experiment(id: string, change: string): RoutineExperiment {
  return {
    id,
    userId: "usr_experiment",
    change,
    baseline: "Cleanser and moisturizer only",
    startedAt: "2026-07-26T00:00:00.000Z",
    status: "active",
    createdAt: "2026-07-26T00:00:00.000Z",
  };
}

describe("routine experiments", () => {
  test("encrypts content and keeps only routing metadata in plaintext", async () => {
    await createRoutineExperiment(experiment("exp_1", "Add azelaic acid"));
    const [row] = fakeDb.rows(routineExperiments);
    expect(row?.status).toBe("active");
    expect(row?.userId).toBe("usr_experiment");
    expect(String(row?.value)).toStartWith("enc:");
    expect(row).not.toHaveProperty("change");
    expect(row).not.toHaveProperty("baseline");
  });

  test("returns the current experiment instead of overwriting it", async () => {
    const result = await createRoutineExperiment(experiment("exp_2", "Add retinol"));
    expect(result.created).toBe(false);
    expect(result.experiment.id).toBe("exp_1");
    expect((await listRoutineExperiments("usr_experiment")).map((item) => item.id)).toEqual([
      "exp_1",
    ]);
  });

  test("supports completion and then allows a new active experiment", async () => {
    const closed = await closeRoutineExperiment("usr_experiment", "exp_1", {
      status: "completed",
      outcome: "helped",
      outcomeNotes: "Less redness",
    });
    expect(closed?.outcome).toBe("helped");
    expect(await getActiveRoutineExperiment("usr_experiment")).toBeNull();

    const next = await createRoutineExperiment(experiment("exp_3", "Change cleanser"));
    expect(next.created).toBe(true);
    expect((await getActiveRoutineExperiment("usr_experiment"))?.id).toBe("exp_3");
  });
});
