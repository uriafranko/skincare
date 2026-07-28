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

// Keep this insertion order stable: tool definitions are part of the cached prompt prefix.
export const skintextAgentTools = {
  routine: routineTool,
  setTimezone: setTimezoneTool,
  setReminders: setRemindersTool,
  getReminders: getRemindersTool,
  scheduleOneOffReminder: scheduleOneOffReminderTool,
  listOneOffReminders: listOneOffRemindersTool,
  cancelOneOffReminder: cancelOneOffReminderTool,
  sendUiMessage: sendUiMessageTool,
  listUserImages: listUserImagesTool,
  inspectUserImage: inspectUserImageTool,
  sendUserImage: sendUserImageTool,
  managePhotoRetention: managePhotoRetentionTool,
  deleteSavedPhotos: deleteSavedPhotosTool,
  deleteAccount: deleteAccountTool,
};
