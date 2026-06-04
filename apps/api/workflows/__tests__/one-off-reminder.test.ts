import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

let waitMs = 0;
let reminderQueue: unknown[] = [];
let user: unknown = null;

const sleep = mock(() => Promise.resolve());
const loadOneOffReminder = mock(() => Promise.resolve(reminderQueue.shift() ?? null));
const loadUser = mock(() => Promise.resolve(user));
const markOneOffReminderFailed = mock(() => Promise.resolve());
const markOneOffReminderSent = mock(() => Promise.resolve());
const sendMsg = mock(() => Promise.resolve());

mock.module("workflow", () => ({
  sleep,
}));

mock.module("@skintext/shared", () => createSharedMock({ msUntil: () => waitMs }));

mock.module("../steps/reminder-steps", () => ({
  loadOneOffReminder,
  loadUser,
  markOneOffReminderFailed,
  markOneOffReminderSent,
  sendMsg,
}));

const { oneOffReminderWorkflow } = await import("../one-off-reminder");

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
      consentedAt: "2026-06-04T12:00:00.000Z",
    };
    sleep.mockClear();
    loadOneOffReminder.mockClear();
    loadUser.mockClear();
    markOneOffReminderFailed.mockClear();
    markOneOffReminderSent.mockClear();
    sendMsg.mockClear();
  });

  test("sleeps until sendAt, sends once, and marks sent", async () => {
    waitMs = 1000;
    reminderQueue = [scheduledReminder, scheduledReminder];

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sleep).toHaveBeenCalledWith("1000ms");
    expect(sendMsg).toHaveBeenCalledWith("usr_test", "Check whether irritation improved.");
    expect(sendMsg).toHaveBeenCalledTimes(1);
    expect(markOneOffReminderSent).toHaveBeenCalledWith("usr_test", "reminder_1");
  });

  test("does not send a cancelled reminder after waking", async () => {
    reminderQueue = [scheduledReminder, { ...scheduledReminder, status: "cancelled" }];

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendMsg).not.toHaveBeenCalled();
    expect(markOneOffReminderSent).not.toHaveBeenCalled();
  });

  test("exits cleanly if the user was deleted", async () => {
    reminderQueue = [scheduledReminder, scheduledReminder];
    user = null;

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendMsg).not.toHaveBeenCalled();
    expect(markOneOffReminderSent).not.toHaveBeenCalled();
    expect(markOneOffReminderFailed).not.toHaveBeenCalled();
  });

  test("marks failed if consent was withdrawn before delivery", async () => {
    reminderQueue = [scheduledReminder, scheduledReminder];
    user = { id: "usr_test", consentedAt: null };

    await oneOffReminderWorkflow("usr_test", "reminder_1");

    expect(sendMsg).not.toHaveBeenCalled();
    expect(markOneOffReminderFailed).toHaveBeenCalledWith("usr_test", "reminder_1");
  });
});
