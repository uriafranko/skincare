import { deleteAccountTool } from "./delete-account";
import {
  cancelOneOffReminderTool,
  listOneOffRemindersTool,
  scheduleOneOffReminderTool,
} from "./one-off-reminders";
import { deleteSavedPhotosTool, managePhotoRetentionTool } from "./privacy";
import { routineTool } from "./routine";
import { sendUiMessageTool } from "./send-ui-message";
import { getRemindersTool, setRemindersTool, setTimezoneTool } from "./set-reminders";
import { inspectUserImageTool, listUserImagesTool, sendUserImageTool } from "./user-images";

const routineTools = {
  routine: routineTool,
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
  inspectUserImage: inspectUserImageTool,
  sendUserImage: sendUserImageTool,
};

const privacyAndAccountTools = {
  managePhotoRetention: managePhotoRetentionTool,
  deleteSavedPhotos: deleteSavedPhotosTool,
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
