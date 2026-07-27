import { deleteAccountTool } from "./delete-account";
import {
  closeExperimentTool,
  getActiveExperimentTool,
  listExperimentsTool,
  startExperimentTool,
} from "./experiments";
import { exportDataTool } from "./export-data";
import {
  cancelOneOffReminderTool,
  listOneOffRemindersTool,
  scheduleOneOffReminderTool,
} from "./one-off-reminders";
import {
  clearConversationHistoryTool,
  deleteSavedPhotosTool,
  getPersonalizationSummaryTool,
  saveCurrentPhotoTool,
  setPhotoRetentionTool,
} from "./privacy";
import {
  deleteAllProductsTool,
  deleteProductTool,
  listProductsTool,
  logProductUseTool,
  saveProductTool,
} from "./products";
import {
  deleteRoutineEntryTool,
  getTodayRoutineLogTool,
  getWeeklyRoutineLogTool,
  logRoutineStepTool,
} from "./routine";
import { sendUiMessageTool } from "./send-ui-message";
import { getRemindersTool, setRemindersTool } from "./set-reminders";
import { updateProfileTool } from "./update-profile";
import { listUserImagesTool, sendUserImageTool } from "./user-images";

const routineTools = {
  logRoutineStep: logRoutineStepTool,
  deleteRoutineEntry: deleteRoutineEntryTool,
  getTodayRoutineLog: getTodayRoutineLogTool,
  getWeeklyRoutineLog: getWeeklyRoutineLogTool,
};

const productTools = {
  saveProduct: saveProductTool,
  deleteProduct: deleteProductTool,
  deleteAllProducts: deleteAllProductsTool,
  listProducts: listProductsTool,
  logProductUse: logProductUseTool,
};

const profileTools = {
  updateProfile: updateProfileTool,
  getPersonalizationSummary: getPersonalizationSummaryTool,
};

const reminderTools = {
  setReminders: setRemindersTool,
  getReminders: getRemindersTool,
  scheduleOneOffReminder: scheduleOneOffReminderTool,
  listOneOffReminders: listOneOffRemindersTool,
  cancelOneOffReminder: cancelOneOffReminderTool,
};

const experimentTools = {
  startExperiment: startExperimentTool,
  getActiveExperiment: getActiveExperimentTool,
  listExperiments: listExperimentsTool,
  closeExperiment: closeExperimentTool,
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
  clearConversationHistory: clearConversationHistoryTool,
  exportData: exportDataTool,
  deleteAccount: deleteAccountTool,
};

// Keep this insertion order stable: tool definitions are part of the cached prompt prefix.
export const skintextAgentTools = {
  ...routineTools,
  ...productTools,
  ...profileTools,
  ...reminderTools,
  ...experimentTools,
  ...mediaTools,
  ...privacyAndAccountTools,
};
