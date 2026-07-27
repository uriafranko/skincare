import { mock } from "bun:test";

export const cancelOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const createOneOffReminder = mock(() => Promise.resolve());
export const deleteAllUserData = mock(() => Promise.resolve());
export const deleteCustomReminderTimes = mock(() => Promise.resolve());
export const deleteRoutineEntry = mock(() => Promise.resolve());
export const getAdherenceStreak = mock(() => Promise.resolve(0));
export const getCustomReminderTimes = mock(() => Promise.resolve(null as unknown));
export const getOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const getRoutineEntry = mock(() => Promise.resolve(null as unknown));
export const getRoutineLogForDate = mock(() => Promise.resolve([] as unknown[]));
export const getUser = mock(() => Promise.resolve(null as unknown));
export const getUserImage = mock(() => Promise.resolve(null as unknown));
export const getWeeklyRoutineLogs = mock(() => Promise.resolve([] as unknown[]));
export const listOneOffReminders = mock(() => Promise.resolve([] as unknown[]));
export const listUserImages = mock(() => Promise.resolve([] as unknown[]));
export const markOneOffReminderFailed = mock(() => Promise.resolve());
export const saveExportBlob = mock(() => Promise.resolve(null as unknown));
export const saveRoutineEntry = mock(() => Promise.resolve());
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
  saveRoutineEntry,
  setCustomReminderTimes,
  setOneOffReminderWorkflowRunId,
  updateUser,
}));
