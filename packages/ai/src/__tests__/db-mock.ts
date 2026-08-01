import { mock } from "bun:test";

export const cancelOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const createOneOffReminder = mock(() => Promise.resolve());
export const deleteAllUserData = mock(() => Promise.resolve());
export const deleteCustomReminderTimes = mock(() => Promise.resolve());
export const deleteRoutineEntry = mock(() => Promise.resolve());
export const getAdherenceStreak = mock(() => Promise.resolve(0));
export const getCustomReminderTimes = mock(() => Promise.resolve(null as unknown));
export const getOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const getRoutineEntry = mock((_entryId: string) => Promise.resolve(null as unknown));
export const getRoutineLogForDate = mock(
  (_userId: string, _localDate: string): Promise<unknown> =>
    Promise.resolve({
      entries: [],
      entryCount: 0,
      completedSlots: [],
      productsUsed: [],
      reactions: [],
    }),
);
export const getUser = mock(() => Promise.resolve(null as unknown));
export const getUserImage = mock(() => Promise.resolve(null as unknown));
export const getWeeklyRoutineLogs = mock((_userId: string, _endDate: string) =>
  Promise.resolve([] as unknown[]),
);
export const listOneOffReminders = mock(() => Promise.resolve([] as unknown[]));
export const listUserImages = mock(() => Promise.resolve([] as unknown[]));
export const markOneOffReminderFailed = mock(() => Promise.resolve());
export const saveExportBlob = mock(() => Promise.resolve(null as unknown));
export const saveUserFeedback = mock((_feedback: unknown) => Promise.resolve());
export const saveRoutineEntry = mock((_entry: unknown) => Promise.resolve());
export const setCustomReminderTimes = mock(() => Promise.resolve());
export const setOneOffReminderWorkflowRunId = mock(() => Promise.resolve());
export const updateUser = mock(() => Promise.resolve());

mock.module("@skintext/db", () => ({
  cancelOneOffReminder,
  createOneOffReminder,
  deleteAllUserData,
  deleteCustomReminderTimes,
  deleteRoutineEntry,
  getAdherenceStreak,
  getCustomReminderTimes,
  getOneOffReminder,
  getRoutineEntry,
  getRoutineLogForDate,
  getUser,
  getUserImage,
  getWeeklyRoutineLogs,
  listOneOffReminders,
  listUserImages,
  markOneOffReminderFailed,
  saveExportBlob,
  saveUserFeedback,
  saveRoutineEntry,
  setCustomReminderTimes,
  setOneOffReminderWorkflowRunId,
  updateUser,
}));
