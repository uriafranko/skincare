import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  createOneOffReminder,
  createRoutineExperiment,
  markOneOffReminderFailed,
  saveRoutineExperiment,
  setOneOffReminderWorkflowRunId,
} from "./db-mock";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () =>
  createSharedMock({
    generateId: (prefix?: string) =>
      prefix === "experiment" ? "experiment_test" : "reminder_test",
  }),
);

const { startExperimentTool } = await import("../tools/experiments");

function execute(scheduleWorkflow: () => Promise<string>) {
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    userId: "usr_experiment",
    timezone: "UTC",
    inputText: "try this for a week",
    hasImage: false,
    isScheduledEvent: false,
    agentContext: {
      activeExperiment: null,
      userProfile: { timezoneConfirmed: true },
    },
    scheduleOneOffReminderWorkflow: scheduleWorkflow,
  });
  return (
    startExperimentTool as unknown as {
      execute: (input: Record<string, unknown>, options: unknown) => Promise<unknown>;
    }
  ).execute(
    {
      change: "Use azelaic acid every other night",
      baseline: "Cleanser and moisturizer only",
      reviewSchedule: { type: "relative", amount: 1, unit: "weeks" },
    },
    { requestContext },
  );
}

describe("experiment reminder linkage", () => {
  beforeEach(() => {
    createRoutineExperiment.mockClear();
    saveRoutineExperiment.mockClear();
    createOneOffReminder.mockClear();
    markOneOffReminderFailed.mockClear();
    setOneOffReminderWorkflowRunId.mockClear();
  });

  test("retains the experiment when follow-up scheduling fails", async () => {
    const result = await execute(() => Promise.reject(new Error("workflow unavailable")));
    expect(result).toEqual(
      expect.objectContaining({
        started: true,
        reminderScheduled: false,
        reminderError: "Could not start reminder workflow.",
      }),
    );
    expect(createRoutineExperiment).toHaveBeenCalledTimes(1);
    expect(markOneOffReminderFailed).toHaveBeenCalledWith("usr_experiment", "reminder_test");
    expect(saveRoutineExperiment).not.toHaveBeenCalled();
  });

  test("links a successful skin check-in reminder to the experiment", async () => {
    const result = await execute(() => Promise.resolve("run_test"));
    expect(result).toEqual(
      expect.objectContaining({
        started: true,
        reminderScheduled: true,
        experiment: expect.objectContaining({ reminderId: "reminder_test" }),
      }),
    );
    expect(saveRoutineExperiment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "experiment_test",
        reminderId: "reminder_test",
      }),
    );
  });
});
