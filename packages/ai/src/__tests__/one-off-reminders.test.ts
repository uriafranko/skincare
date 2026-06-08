import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

const createOneOffReminder = mock(() => Promise.resolve());
const deleteCustomReminderTimes = mock(() => Promise.resolve());
const getCustomReminderTimes = mock(() => Promise.resolve(null));
const setCustomReminderTimes = mock(() => Promise.resolve());
const setOneOffReminderWorkflowRunId = mock(() => Promise.resolve());
const markOneOffReminderFailed = mock(() => Promise.resolve());

mock.module("@skintext/db", () => ({
  createOneOffReminder,
  deleteCustomReminderTimes,
  getCustomReminderTimes,
  setCustomReminderTimes,
  setOneOffReminderWorkflowRunId,
  markOneOffReminderFailed,
}));

mock.module("@skintext/shared", () =>
  createSharedMock({
    generateId: () => "reminder_test",
    localDateTimeToDate: (date: string, hour: number, minute: number, timezone: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!match) return null;
      const [, year, month, day] = match;
      const offsetHours = timezone === "America/New_York" ? 4 : 0;
      return new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day), hour + offsetHours, minute),
      );
    },
    getLocaleName: (locale: string) => {
      const names: Record<string, string> = { en: "English", sv: "Swedish" };
      return names[locale] ?? "English";
    },
  }),
);

const { scheduleOneOffReminder } = await import("../tools/one-off-reminders");
const { createSetRemindersTool, getRemindersTool } = await import("../tools/set-reminders");

function executeTool(tool: unknown, input: Record<string, unknown>) {
  return (
    tool as { execute: (args: Record<string, unknown>, options: unknown) => Promise<unknown> }
  ).execute(input, {});
}

describe("scheduleOneOffReminder", () => {
  beforeEach(() => {
    createOneOffReminder.mockClear();
    deleteCustomReminderTimes.mockClear();
    getCustomReminderTimes.mockClear();
    setCustomReminderTimes.mockClear();
    setOneOffReminderWorkflowRunId.mockClear();
    markOneOffReminderFailed.mockClear();
  });

  test("rejects past local schedules before persistence", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_123"));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        schedule: {
          type: "local_time",
          date: "2026-06-04",
          hour: 7,
          minute: 0,
        },
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

  test("accepts relative future delays and starts a user-scoped workflow", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_123"));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        schedule: {
          type: "relative",
          amount: 1,
          unit: "days",
        },
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

  test("accepts user-local date/time schedules", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_456"));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        schedule: {
          type: "local_time",
          date: "2026-06-05",
          hour: 8,
          minute: 0,
        },
        kind: "custom",
        message: "Morning check-in.",
      },
      scheduleWorkflow,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(result.scheduled).toBe(true);
    expect(result.sendAt).toBe("2026-06-05T12:00:00.000Z");
  });

  test("marks reminders failed when workflow startup fails", async () => {
    const scheduleWorkflow = mock(() => Promise.reject(new Error("workflow unavailable")));
    const result = await scheduleOneOffReminder(
      {
        userId: "usr_test",
        timezone: "America/New_York",
        schedule: {
          type: "relative",
          amount: 1,
          unit: "days",
        },
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

describe("recurring reminder tools", () => {
  beforeEach(() => {
    deleteCustomReminderTimes.mockClear();
    getCustomReminderTimes.mockClear();
    setCustomReminderTimes.mockClear();
  });

  test("stores exact opt-in reminder times and syncs the workflow", async () => {
    const syncSchedule = mock(() => Promise.resolve("run_123"));
    const tool = createSetRemindersTool(syncSchedule);
    const times = [
      { label: "morning", hour: 9, minute: 30 },
      { label: "evening", hour: 20, minute: 45 },
    ];

    const result = await executeTool(tool, { userId: "usr_test", times });

    expect(setCustomReminderTimes).toHaveBeenCalledWith("usr_test", times);
    expect(deleteCustomReminderTimes).not.toHaveBeenCalled();
    expect(syncSchedule).toHaveBeenCalledWith({ userId: "usr_test", enabled: true });
    expect(result).toEqual({
      updated: true,
      enabled: true,
      schedule: ["morning: 09:30", "evening: 20:45"],
      workflowRunId: "run_123",
    });
  });

  test("turns recurring reminders off with an empty schedule", async () => {
    const syncSchedule = mock(() => Promise.resolve(undefined));
    const tool = createSetRemindersTool(syncSchedule);

    const result = await executeTool(tool, { userId: "usr_test", enabled: false, times: [] });

    expect(deleteCustomReminderTimes).toHaveBeenCalledWith("usr_test");
    expect(setCustomReminderTimes).not.toHaveBeenCalled();
    expect(syncSchedule).toHaveBeenCalledWith({ userId: "usr_test", enabled: false });
    expect(result).toEqual({
      updated: true,
      enabled: false,
      schedule: [],
      workflowRunId: null,
    });
  });

  test("reports recurring reminders as disabled when no schedule exists", async () => {
    getCustomReminderTimes.mockResolvedValueOnce(null);

    const result = await executeTool(getRemindersTool, { userId: "usr_test" });

    expect(result).toEqual({ enabled: false, schedule: [] });
  });
});
