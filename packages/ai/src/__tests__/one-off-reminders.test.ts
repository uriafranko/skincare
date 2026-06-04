import { beforeEach, describe, expect, mock, test } from "bun:test";

const createOneOffReminder = mock(() => Promise.resolve());
const setOneOffReminderWorkflowRunId = mock(() => Promise.resolve());
const markOneOffReminderFailed = mock(() => Promise.resolve());

mock.module("@skintext/db", () => ({
  createOneOffReminder,
  setOneOffReminderWorkflowRunId,
  markOneOffReminderFailed,
}));

mock.module("@skintext/shared", () => ({
  generateId: () => "reminder_test",
}));

const { scheduleOneOffReminder } = await import("../tools/one-off-reminders");

describe("scheduleOneOffReminder", () => {
  beforeEach(() => {
    createOneOffReminder.mockClear();
    setOneOffReminderWorkflowRunId.mockClear();
    markOneOffReminderFailed.mockClear();
  });

  test("rejects past timestamps before persistence", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_123"));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        sendAt: "2026-06-04T11:00:00.000Z",
        kind: "custom",
        message: "Check in.",
      },
      scheduleWorkflow,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(result.scheduled).toBe(false);
    expect(createOneOffReminder).not.toHaveBeenCalled();
    expect(scheduleWorkflow).not.toHaveBeenCalled();
  });

  test("accepts future timestamps and starts a user-scoped workflow", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_123"));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        sendAt: "2026-06-05T12:00:00.000Z",
        kind: "skin_checkin",
        message: " Check whether irritation improved. ",
      },
      scheduleWorkflow,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(result).toEqual({
      scheduled: true,
      reminderId: "reminder_test",
      sendAt: "2026-06-05T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "skin_checkin",
      message: "Check whether irritation improved.",
      workflowRunId: "run_123",
    });
    expect(createOneOffReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "reminder_test",
        userId: "usr_test",
        timezone: "America/New_York",
        status: "scheduled",
      }),
    );
    expect(scheduleWorkflow).toHaveBeenCalledWith({
      userId: "usr_test",
      reminderId: "reminder_test",
    });
    expect(setOneOffReminderWorkflowRunId).toHaveBeenCalledWith(
      "usr_test",
      "reminder_test",
      "run_123",
    );
  });

  test("marks reminders failed when workflow startup fails", async () => {
    const scheduleWorkflow = mock(() => Promise.reject(new Error("workflow unavailable")));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        sendAt: "2026-06-05T12:00:00.000Z",
        kind: "custom",
        message: "Try again.",
      },
      scheduleWorkflow,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(result).toEqual({
      scheduled: false,
      reminderId: "reminder_test",
      error: "Could not start reminder workflow.",
    });
    expect(markOneOffReminderFailed).toHaveBeenCalledWith("usr_test", "reminder_test");
  });
});
