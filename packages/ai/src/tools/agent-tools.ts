import { deleteAccountTool } from "./delete-account";
import { exportDataTool } from "./export-data";
import {
  cancelOneOffReminderTool,
  listOneOffRemindersTool,
  scheduleOneOffReminderTool,
} from "./one-off-reminders";
import { deleteSavedPhotosTool, saveCurrentPhotoTool, setPhotoRetentionTool } from "./privacy";
import {
  deleteRoutineEntryTool,
  getTodayRoutineLogTool,
  getWeeklyRoutineLogTool,
  logRoutineStepTool,
} from "./routine";
import { sendUiMessageTool } from "./send-ui-message";
import { getRemindersTool, setRemindersTool, setTimezoneTool } from "./set-reminders";
import { listUserImagesTool, sendUserImageTool } from "./user-images";

const routineTools = {
  logRoutineStep: logRoutineStepTool,
  deleteRoutineEntry: deleteRoutineEntryTool,
  getTodayRoutineLog: getTodayRoutineLogTool,
  getWeeklyRoutineLog: getWeeklyRoutineLogTool,
};

const localizationTools = {
  setTimezone: setTimezoneTool,
};

const reminderTools = {
  setReminders: setRemindersTool,
  getReminders: getRemindersTool,
  scheduleOneOffReminder: scheduleOneOffReminderTool,
  listOneOffReminders: listOneOffRemindersTool,
  cancelOneOffReminder: cancelOneOffReminderTool,
};

const mediaTools = {
  sendUiMessage: sendUiMessageTool,
  listUserImages: listUserImagesTool,
  sendUserImage: sendUserImageTool,
};

const privacyAndAccountTools = {
  setPhotoRetention: setPhotoRetentionTool,
  saveCurrentPhoto: saveCurrentPhotoTool,
  deleteSavedPhotos: deleteSavedPhotosTool,
  exportData: exportDataTool,
  deleteAccount: deleteAccountTool,
};

// Keep this insertion order stable: tool definitions are part of the cached prompt prefix.
export const skintextAgentTools = {
  ...routineTools,
  ...localizationTools,
  ...reminderTools,
  ...mediaTools,
  ...privacyAndAccountTools,
};
