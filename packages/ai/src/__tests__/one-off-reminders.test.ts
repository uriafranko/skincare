import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import {
  cancelOneOffReminder,
  createOneOffReminder,
  deleteCustomReminderTimes,
  getCustomReminderTimes,
  getOneOffReminder,
  listOneOffReminders,
  markOneOffReminderFailed,
  setCustomReminderTimes,
  setOneOffReminderWorkflowRunId,
  updateUser,
} from "./db-mock";
import { createSharedMock } from "./shared-mock";

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

const {
  cancelOneOffReminderTool,
  listOneOffRemindersTool,
  scheduleOneOffReminder,
  scheduleOneOffReminderTool,
} = await import("../tools/one-off-reminders");
const { getRemindersTool, setRemindersTool, setTimezoneTool } = await import(
  "../tools/set-reminders"
);

function executeTool(
  tool: unknown,
  input: Record<string, unknown>,
  runtime: Record<string, unknown> = {},
) {
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    userId: "usr_test",
    timezone: "America/New_York",
    agentContext: { userAccount: { timezoneConfirmed: true } },
    ...runtime,
  });
  return (
    tool as { execute: (args: Record<string, unknown>, options: unknown) => Promise<unknown> }
  ).execute(input, { requestContext });
}

describe("scheduleOneOffReminder", () => {
  beforeEach(() => {
    createOneOffReminder.mockClear();
    cancelOneOffReminder.mockClear();
    deleteCustomReminderTimes.mockClear();
    getCustomReminderTimes.mockClear();
    getOneOffReminder.mockClear();
    listOneOffReminders.mockClear();
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

  test("requires a user-confirmed timezone for explicit local schedules", async () => {
    const scheduleWorkflow = mock(() => Promise.resolve("run_123"));
    const result = await executeTool(
      scheduleOneOffReminderTool,
      {
        schedule: { type: "local_time", date: "2026-06-05", hour: 8, minute: 0 },
        message: "Morning check-in.",
      },
      {
        agentContext: { userAccount: { timezoneConfirmed: false } },
        scheduleOneOffReminderWorkflow: scheduleWorkflow,
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        scheduled: false,
        needsTimezoneConfirmation: true,
      }),
    );
    expect(createOneOffReminder).not.toHaveBeenCalled();
    expect(scheduleWorkflow).not.toHaveBeenCalled();
  });
});

describe("one-off reminder management tools", () => {
  beforeEach(() => {
    cancelOneOffReminder.mockClear();
    getOneOffReminder.mockClear();
    listOneOffReminders.mockClear();
  });

  test("lists only the current user's pending reminders", async () => {
    listOneOffReminders.mockResolvedValueOnce([
      {
        id: "reminder_pending",
        userId: "usr_test",
        sendAt: "2026-06-05T12:00:00.000Z",
        timezone: "America/New_York",
        kind: "custom",
        message: "Check in.",
        status: "scheduled",
        createdAt: "2026-06-04T12:00:00.000Z",
      },
      {
        id: "reminder_sent",
        userId: "usr_test",
        sendAt: "2026-06-04T12:00:00.000Z",
        timezone: "America/New_York",
        kind: "custom",
        message: "Already sent.",
        status: "sent",
        createdAt: "2026-06-03T12:00:00.000Z",
      },
    ]);

    const result = await executeTool(listOneOffRemindersTool, {});

    expect(listOneOffReminders).toHaveBeenCalledWith("usr_test");
    expect(result).toEqual({
      reminders: [
        expect.objectContaining({
          id: "reminder_pending",
          status: "scheduled",
        }),
      ],
    });
  });

  test("cancels the user-scoped reminder and its sleeping workflow", async () => {
    const reminder = {
      id: "reminder_pending",
      userId: "usr_test",
      sendAt: "2026-06-05T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "custom" as const,
      message: "Check in.",
      status: "scheduled" as const,
      createdAt: "2026-06-04T12:00:00.000Z",
      workflowRunId: "run_123",
    };
    getOneOffReminder.mockResolvedValueOnce(reminder);
    cancelOneOffReminder.mockResolvedValueOnce({ ...reminder, status: "cancelled" });
    const cancelWorkflow = mock(() => Promise.resolve(true));

    const result = await executeTool(
      cancelOneOffReminderTool,
      { reminderId: "reminder_pending", userId: "usr_attacker" },
      { cancelOneOffReminderWorkflow: cancelWorkflow },
    );

    expect(getOneOffReminder).toHaveBeenCalledWith("usr_test", "reminder_pending");
    expect(cancelWorkflow).toHaveBeenCalledWith({
      userId: "usr_test",
      reminderId: "reminder_pending",
      workflowRunId: "run_123",
    });
    expect(cancelOneOffReminder).toHaveBeenCalledWith("usr_test", "reminder_pending");
    expect(result).toEqual(
      expect.objectContaining({
        cancelled: true,
        reminderId: "reminder_pending",
        workflowCancelled: true,
      }),
    );
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
    const times = [
      { label: "morning", hour: 9, minute: 30 },
      { label: "evening", hour: 20, minute: 45 },
    ];

    const result = await executeTool(
      setRemindersTool,
      { times },
      { syncRecurringReminderSchedule: syncSchedule },
    );

    expect(setCustomReminderTimes).toHaveBeenCalledWith("usr_test", times);
    expect(deleteCustomReminderTimes).not.toHaveBeenCalled();
    expect(syncSchedule).toHaveBeenCalledWith({ userId: "usr_test", enabled: true });
    expect(result).toEqual({
      updated: true,
      enabled: true,
      schedule: ["morning: 09:30", "evening: 20:45"],
      timezone: "America/New_York",
      workflowRunId: "run_123",
    });
  });

  test("ignores model-supplied user IDs and uses the trusted request context", async () => {
    const times = [{ label: "morning", hour: 9, minute: 30 }];

    await executeTool(setRemindersTool, { userId: "usr_attacker", times });

    expect(setCustomReminderTimes).toHaveBeenCalledWith("usr_test", times);
  });

  test("turns recurring reminders off with an empty schedule", async () => {
    const syncSchedule = mock(() => Promise.resolve(undefined));
    const result = await executeTool(
      setRemindersTool,
      { enabled: false, times: [] },
      { syncRecurringReminderSchedule: syncSchedule },
    );

    expect(deleteCustomReminderTimes).toHaveBeenCalledWith("usr_test");
    expect(setCustomReminderTimes).not.toHaveBeenCalled();
    expect(syncSchedule).toHaveBeenCalledWith({ userId: "usr_test", enabled: false });
    expect(result).toEqual({
      updated: true,
      enabled: false,
      schedule: [],
      timezone: "America/New_York",
      workflowRunId: null,
    });
  });

  test("reports recurring reminders as disabled when no schedule exists", async () => {
    getCustomReminderTimes.mockResolvedValueOnce(null);

    const result = await executeTool(getRemindersTool, {});

    expect(result).toEqual({
      enabled: false,
      schedule: [],
      timezone: "America/New_York",
      timezoneConfirmed: true,
    });
  });

  test("requires a user-confirmed timezone before enabling recurring reminders", async () => {
    const result = await executeTool(
      setRemindersTool,
      { times: [{ label: "morning", hour: 9, minute: 30 }] },
      { agentContext: { userAccount: { timezoneConfirmed: false } } },
    );

    expect(result).toEqual(
      expect.objectContaining({
        updated: false,
        needsTimezoneConfirmation: true,
      }),
    );
    expect(setCustomReminderTimes).not.toHaveBeenCalled();
  });
});

describe("operational timezone updates", () => {
  beforeEach(() => {
    getCustomReminderTimes.mockClear();
    updateUser.mockClear();
  });

  test("validates and persists a user-stated IANA timezone as confirmed", async () => {
    getCustomReminderTimes.mockResolvedValueOnce([{ label: "morning", hour: 8, minute: 0 }]);
    const syncSchedule = mock(() => Promise.resolve("run_123"));

    const result = await executeTool(
      setTimezoneTool,
      { timezone: "Asia/Jerusalem" },
      {
        agentContext: {
          timezone: "America/New_York",
          localDate: "2026-06-04",
          userAccount: { timezone: "America/New_York", timezoneConfirmed: false },
        },
        syncRecurringReminderSchedule: syncSchedule,
      },
    );

    expect(updateUser).toHaveBeenCalledWith("usr_test", {
      timezone: "Asia/Jerusalem",
      timezoneConfirmed: "true",
    });
    expect(syncSchedule).toHaveBeenCalledWith({ userId: "usr_test", enabled: true });
    expect(result).toEqual(
      expect.objectContaining({
        updated: true,
        timezone: "Asia/Jerusalem",
        timezoneConfirmed: true,
        recurringRemindersResynced: true,
      }),
    );
  });

  test("rejects an unvalidated city label", async () => {
    const result = await executeTool(setTimezoneTool, { timezone: "Jerusalem" });

    expect(result).toEqual(
      expect.objectContaining({
        updated: false,
      }),
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("accepts only the operational timezone field", async () => {
    const runtime = {
      agentContext: {
        timezone: "Asia/Jerusalem",
        localDate: "2026-07-26",
        userAccount: { timezone: "Asia/Jerusalem", timezoneConfirmed: false },
      },
    };

    const result = await executeTool(
      setTimezoneTool,
      {
        timezone: "Asia/Jerusalem",
      },
      runtime,
    );

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith("usr_test", {
      timezone: "Asia/Jerusalem",
      timezoneConfirmed: "true",
    });
    expect(result).toEqual(
      expect.objectContaining({
        updated: true,
        timezone: "Asia/Jerusalem",
      }),
    );
  });
});
