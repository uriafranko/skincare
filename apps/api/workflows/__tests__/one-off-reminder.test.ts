import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

let waitMs = 0;
let reminderQueue: unknown[] = [];
let user: unknown = null;

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
const loadRoutineLog = mock(() =>
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
  sendReminderToAgent,
}));

const { USER_REMINDER_CLOSE_TAG, USER_REMINDER_OPEN_TAG, wrapUserReminder } = await import(
  "../../../../packages/ai/src/user-reminder"
);
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
    sendReminderToAgent.mockClear();
    sendReminderToAgent.mockResolvedValue(true);
  });

  test("wraps reminder input for synthetic agent turns", () => {
    expect(wrapUserReminder("Check whether irritation improved.")).toBe(
      `${USER_REMINDER_OPEN_TAG}\nCheck whether irritation improved.\n${USER_REMINDER_CLOSE_TAG}`,
    );
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
    sendReminderToAgent.mockClear();
  });

  test("exits without sending routine reminders when no opt-in schedule exists", async () => {
    loadUser.mockResolvedValueOnce(user);
    loadReminderTimes.mockResolvedValueOnce(null);

    await reminderLoop("usr_test");

    expect(clearReminderRunId).toHaveBeenCalledWith("usr_test");
    expect(buildRoutineReminder).not.toHaveBeenCalled();
    expect(buildDailySummaryReminder).not.toHaveBeenCalled();
    expect(sendReminderToAgent).not.toHaveBeenCalled();
  });

  test("uses only the reminder slots saved by the agent", async () => {
    loadUser.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    loadReminderTimes.mockResolvedValueOnce([{ label: "morning", hour: 9, minute: 30 }]);

    await reminderLoop("usr_test");

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
    expect(sendReminderToAgent).toHaveBeenCalledWith("usr_test", "Routine reminder event.");
  });
});
