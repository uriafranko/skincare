import { mock } from "bun:test";

export const cancelOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const closeRoutineExperiment = mock(() => Promise.resolve(null as unknown));
export const createOneOffReminder = mock(() => Promise.resolve());
export const createRoutineExperiment = mock((experiment: Record<string, unknown>) =>
  Promise.resolve({ created: true as const, experiment }),
);
export const deleteCustomReminderTimes = mock(() => Promise.resolve());
export const getActiveRoutineExperiment = mock(() => Promise.resolve(null as unknown));
export const getAllProducts = mock(() => Promise.resolve([] as unknown[]));
export const getCustomReminderTimes = mock(() => Promise.resolve(null as unknown));
export const getOneOffReminder = mock(() => Promise.resolve(null as unknown));
export const getUser = mock(() => Promise.resolve(null as unknown));
export const listOneOffReminders = mock(() => Promise.resolve([] as unknown[]));
export const listRoutineExperiments = mock(() => Promise.resolve([] as unknown[]));
export const markOneOffReminderFailed = mock(() => Promise.resolve());
export const saveRoutineExperiment = mock(() => Promise.resolve());
export const setCustomReminderTimes = mock(() => Promise.resolve());
export const setOneOffReminderWorkflowRunId = mock(() => Promise.resolve());
export const updateUser = mock(() => Promise.resolve());

mock.module("@skintext/db", () => ({
  cancelOneOffReminder,
  closeRoutineExperiment,
  createOneOffReminder,
  createRoutineExperiment,
  deleteCustomReminderTimes,
  getActiveRoutineExperiment,
  getAllProducts,
  getCustomReminderTimes,
  getOneOffReminder,
  getUser,
  listOneOffReminders,
  listRoutineExperiments,
  markOneOffReminderFailed,
  saveRoutineExperiment,
  setCustomReminderTimes,
  setOneOffReminderWorkflowRunId,
  updateUser,
}));
