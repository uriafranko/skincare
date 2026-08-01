import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () => createSharedMock());

const {
  cancelOneOffReminder,
  createOneOffReminder,
  getOneOffReminder,
  listOneOffReminders,
  markOneOffReminderFailed,
  markOneOffReminderSent,
  setOneOffReminderWorkflowRunId,
} = await import("../reminders");

describe("one-off reminders", () => {
  test("creates, retrieves, and lists one-off reminders", async () => {
    await createOneOffReminder({
      id: "reminder_1",
      userId: "usr_test",
      sendAt: "2026-06-11T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "skin_checkin",
      message: "Check whether the redness calmed down.",
      status: "scheduled",
      createdAt: "2026-06-04T12:00:00.000Z",
    });

    const reminder = await getOneOffReminder("usr_test", "reminder_1");
    expect(reminder?.message).toBe("Check whether the redness calmed down.");
    expect(reminder?.status).toBe("scheduled");

    const reminders = await listOneOffReminders("usr_test");
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.id).toBe("reminder_1");
  });

  test("stores workflow run id and status transitions", async () => {
    await createOneOffReminder({
      id: "reminder_1",
      userId: "usr_test",
      sendAt: "2026-06-11T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "skin_checkin",
      message: "Check whether the redness calmed down.",
      status: "scheduled",
      createdAt: "2026-06-04T12:00:00.000Z",
    });
    await setOneOffReminderWorkflowRunId("usr_test", "reminder_1", "run_123");
    expect((await getOneOffReminder("usr_test", "reminder_1"))?.workflowRunId).toBe("run_123");

    await markOneOffReminderSent("usr_test", "reminder_1");
    expect((await getOneOffReminder("usr_test", "reminder_1"))?.status).toBe("sent");

    await createOneOffReminder({
      id: "reminder_2",
      userId: "usr_test",
      sendAt: "2026-06-12T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "custom",
      message: "Bring SPF.",
      status: "scheduled",
      createdAt: "2026-06-04T12:00:00.000Z",
    });
    await cancelOneOffReminder("usr_test", "reminder_2");
    expect((await getOneOffReminder("usr_test", "reminder_2"))?.status).toBe("cancelled");

    await createOneOffReminder({
      id: "reminder_3",
      userId: "usr_test",
      sendAt: "2026-06-13T12:00:00.000Z",
      timezone: "America/New_York",
      kind: "custom",
      message: "Patch test update.",
      status: "scheduled",
      createdAt: "2026-06-04T12:00:00.000Z",
    });
    await markOneOffReminderFailed("usr_test", "reminder_3");
    expect((await getOneOffReminder("usr_test", "reminder_3"))?.status).toBe("failed");
  });
});
