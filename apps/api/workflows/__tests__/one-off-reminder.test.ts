import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

let waitMs = 0;
let reminderQueue: unknown[] = [];
let user: unknown = null;

type MockRoutineLog = {
  entries: unknown[];
  entryCount: number;
  completedSlots: string[];
  productsUsed: string[];
  reactions: string[];
};

const sleep = mock(() => Promise.resolve());
const buildDailySummaryReminder = mock(() => Promise.resolve(null));
const buildRoutineReminder = mock(() => Promise.resolve("Routine reminder event."));
const buildWeeklyRecapReminder = mock(() => Promise.resolve(null));
const clearReminderRunId = mock(() => Promise.resolve());
const loadOneOffReminder = mock(() => Promise.resolve(reminderQueue.shift() ?? null));
const loadReminderTimes = mock(
  (): Promise<Array<{ label: string; hour: number; minute: number }> | null> =>
    Promise.resolve(null),
);
const loadRoutineLog = mock(
  (): Promise<MockRoutineLog> =>
    Promise.resolve({
      entries: [],
      entryCount: 0,
      completedSlots: [],
      productsUsed: [],
      reactions: [],
    }),
);
const loadUser = mock(() => Promise.resolve(user));
const markOneOffReminderFailed = mock(() => Promise.resolve());
const markOneOffReminderSent = mock(() => Promise.resolve());
const ownsReminderRun = mock(() => Promise.resolve(true));
const sendReminderToAgent = mock(() => Promise.resolve(true));

mock.module("workflow", () => ({
  sleep,
}));

mock.module("@skintext/shared", () =>
  createSharedMock({
    isDayOfWeek: () => false,
    msUntil: () => waitMs,
    nextLocalTime: () => new Date(Date.now() - 2000),
  }),
);

mock.module("../steps/reminder-steps", () => ({
  buildDailySummaryReminder,
  buildRoutineReminder,
  buildWeeklyRecapReminder,
  clearReminderRunId,
  loadOneOffReminder,
  loadReminderTimes,
  loadRoutineLog,
  loadUser,
  markOneOffReminderFailed,
  markOneOffReminderSent,
  ownsReminderRun,
  sendReminderToAgent,
}));

const { oneOffReminderWorkflow } = await import("../one-off-reminder");
const { reminderLoop } = await import("../reminder-loop");

const scheduledReminder = {
  id: "reminder_1",
  userId: "usr_test",
  sendAt: "2026-06-05T12:00:00.000Z",
  timezone: "America/New_York",
  kind: "skin_checkin",
  message: "Check whether irritation improved.",
  status: "scheduled",
  createdAt: "2026-06-04T12:00:00.000Z",
};

describe("oneOffReminderWorkflow", () => {
  beforeEach(() => {
    waitMs = 0;
    reminderQueue = [];
    user = {
      id: "usr_test",
      name: "Alice",
      locale: "en",
      timezone: "Asia/Jerusalem",
      consentedAt: "2026-06-04T12:00:00.000Z",
    };
    sleep.mockClear();
    buildDailySummaryReminder.mockClear();
    buildRoutineReminder.mockClear();
    buildWeeklyRecapReminder.mockClear();
    clearReminderRunId.mockClear();
    loadOneOffReminder.mockClear();
    loadReminderTimes.mockClear();
    loadRoutineLog.mockClear();
    loadUser.mockClear();
    markOneOffReminderFailed.mockClear();
    markOneOffReminderSent.mockClear();
    ownsReminderRun.mockClear();
    ownsReminderRun.mockResolvedValue(true);
    sendReminderToAgent.mockClear();
    sendReminderToAgent.mockResolvedValue(true);
  });

  test("sleeps until sendAt, routes once through the agent, and marks sent", async () => {
    waitMs = 1000;
    reminderQueue = [scheduledReminder, scheduledReminder];

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sleep).toHaveBeenCalledWith("1000ms");
    expect(sendReminderToAgent).toHaveBeenCalledWith(
      "usr_test",
      "Check whether irritation improved.",
    );
    expect(sendReminderToAgent).toHaveBeenCalledTimes(1);
    expect(markOneOffReminderSent).toHaveBeenCalledWith("usr_test", "reminder_1");
  });

  test("marks failed if the agent does not produce a reminder reply", async () => {
    reminderQueue = [scheduledReminder, scheduledReminder];
    sendReminderToAgent.mockResolvedValueOnce(false);

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(markOneOffReminderFailed).toHaveBeenCalledWith("usr_test", "reminder_1");
    expect(markOneOffReminderSent).not.toHaveBeenCalled();
  });

  test("does not send a cancelled reminder after waking", async () => {
    reminderQueue = [scheduledReminder, { ...scheduledReminder, status: "cancelled" }];

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendReminderToAgent).not.toHaveBeenCalled();
    expect(markOneOffReminderSent).not.toHaveBeenCalled();
  });

  test("exits cleanly if the user was deleted", async () => {
    reminderQueue = [scheduledReminder, scheduledReminder];
    user = null;

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendReminderToAgent).not.toHaveBeenCalled();
    expect(markOneOffReminderSent).not.toHaveBeenCalled();
    expect(markOneOffReminderFailed).not.toHaveBeenCalled();
  });

  test("marks failed if consent was withdrawn before delivery", async () => {
    reminderQueue = [scheduledReminder, scheduledReminder];
    user = { id: "usr_test", consentedAt: null };

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendReminderToAgent).not.toHaveBeenCalled();
    expect(markOneOffReminderFailed).toHaveBeenCalledWith("usr_test", "reminder_1");
  });
});

describe("reminderLoop", () => {
  beforeEach(() => {
    waitMs = 0;
    user = {
      id: "usr_test",
      name: "Alice",
      locale: "en",
      timezone: "Asia/Jerusalem",
      consentedAt: "2026-06-04T12:00:00.000Z",
    };
    sleep.mockClear();
    buildDailySummaryReminder.mockClear();
    buildRoutineReminder.mockClear();
    buildWeeklyRecapReminder.mockClear();
    clearReminderRunId.mockClear();
    loadReminderTimes.mockClear();
    loadRoutineLog.mockClear();
    loadUser.mockClear();
    ownsReminderRun.mockClear();
    ownsReminderRun.mockResolvedValue(true);
    sendReminderToAgent.mockClear();
  });

  test("exits without sending routine reminders when no opt-in schedule exists", async () => {
    loadUser.mockResolvedValueOnce(user);
    loadReminderTimes.mockResolvedValueOnce(null);

    await reminderLoop("usr_test", "generation_1");

    expect(clearReminderRunId).toHaveBeenCalledWith("usr_test", "generation_1");
    expect(buildRoutineReminder).not.toHaveBeenCalled();
    expect(buildDailySummaryReminder).not.toHaveBeenCalled();
    expect(sendReminderToAgent).not.toHaveBeenCalled();
  });

  test("uses only the reminder slots saved by the agent", async () => {
    loadUser.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    loadReminderTimes.mockResolvedValueOnce([{ label: "morning", hour: 9, minute: 30 }]);

    await reminderLoop("usr_test", "generation_1");

    expect(buildRoutineReminder).toHaveBeenCalledTimes(1);
    expect(buildRoutineReminder).toHaveBeenCalledWith(
      "usr_test",
      "morning",
      "☀️",
      "en",
      "Alice",
      expect.any(Object),
    );
    expect(buildDailySummaryReminder).toHaveBeenCalledWith("usr_test", "en");
    expect(sendReminderToAgent).toHaveBeenCalledWith(
      "usr_test",
      "Routine reminder event.",
      "generation_1",
    );
  });

  test("does not send a routine reminder for an already completed slot", async () => {
    loadUser.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    loadReminderTimes.mockResolvedValueOnce([{ label: "morning", hour: 9, minute: 30 }]);
    loadRoutineLog.mockResolvedValueOnce({
      entries: [],
      entryCount: 1,
      completedSlots: ["morning"],
      productsUsed: ["SPF"],
      reactions: [],
    });

    await reminderLoop("usr_test", "generation_1");

    expect(buildRoutineReminder).not.toHaveBeenCalled();
    expect(sendReminderToAgent).not.toHaveBeenCalled();
  });

  test("exits before sending when a newer deployment owns the reminder run", async () => {
    ownsReminderRun.mockResolvedValueOnce(false);

    await reminderLoop("usr_test", "stale_generation");

    expect(loadUser).not.toHaveBeenCalled();
    expect(buildRoutineReminder).not.toHaveBeenCalled();
    expect(sendReminderToAgent).not.toHaveBeenCalled();
  });
});
