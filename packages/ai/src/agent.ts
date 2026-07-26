import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { deleteUserMemory, mastraStorage, skintextMemory } from "./memory";
import { getDefaultModelName } from "./models";
import { buildSkintextSystemPrompt } from "./prompts";
import {
  createSkintextRequestContext,
  getSkintextRuntime,
  type SkintextRuntime,
  skintextMemoryOptions,
} from "./runtime";
import { deleteAccountTool } from "./tools/delete-account";
import {
  closeExperimentTool,
  getActiveExperimentTool,
  listExperimentsTool,
  startExperimentTool,
} from "./tools/experiments";
import { exportDataTool } from "./tools/export-data";
import {
  cancelOneOffReminderTool,
  listOneOffRemindersTool,
  scheduleOneOffReminderTool,
} from "./tools/one-off-reminders";
import {
  clearConversationHistoryTool,
  deleteSavedPhotosTool,
  getPersonalizationSummaryTool,
  saveCurrentPhotoTool,
  setPhotoRetentionTool,
} from "./tools/privacy";
import {
  deleteAllProductsTool,
  deleteProductTool,
  listProductsTool,
  logProductUseTool,
  saveProductTool,
} from "./tools/products";
import {
  deleteRoutineEntryTool,
  getTodayRoutineLogTool,
  getWeeklyRoutineLogTool,
  logRoutineStepTool,
} from "./tools/routine";
import { sendUiMessageTool } from "./tools/send-ui-message";
import { getRemindersTool, setRemindersTool } from "./tools/set-reminders";
import { updateProfileTool } from "./tools/update-profile";
import { listUserImagesTool, sendUserImageTool } from "./tools/user-images";

const coreTools = {
  logRoutineStep: logRoutineStepTool,
  deleteRoutineEntry: deleteRoutineEntryTool,
  getTodayRoutineLog: getTodayRoutineLogTool,
  getWeeklyRoutineLog: getWeeklyRoutineLogTool,
  saveProduct: saveProductTool,
  deleteProduct: deleteProductTool,
  deleteAllProducts: deleteAllProductsTool,
  listProducts: listProductsTool,
  logProductUse: logProductUseTool,
  updateProfile: updateProfileTool,
  setReminders: setRemindersTool,
  getReminders: getRemindersTool,
  listOneOffReminders: listOneOffRemindersTool,
  cancelOneOffReminder: cancelOneOffReminderTool,
  exportData: exportDataTool,
  deleteAccount: deleteAccountTool,
  listUserImages: listUserImagesTool,
  startExperiment: startExperimentTool,
  getActiveExperiment: getActiveExperimentTool,
  listExperiments: listExperimentsTool,
  closeExperiment: closeExperimentTool,
  getPersonalizationSummary: getPersonalizationSummaryTool,
  clearConversationHistory: clearConversationHistoryTool,
  setPhotoRetention: setPhotoRetentionTool,
};

export const skintextAgent = new Agent({
  id: "skintext-agent",
  name: "Skintext",
  model: getDefaultModelName(),
  memory: skintextMemory,
  instructions: ({ requestContext }) =>
    buildSkintextSystemPrompt(getSkintextRuntime(requestContext).agentContext),
  tools: ({ requestContext }) => {
    const runtime = getSkintextRuntime(requestContext);
    return {
      ...coreTools,
      ...(runtime.sendUiMessage ? { sendUiMessage: sendUiMessageTool } : {}),
      ...(runtime.sendUserImage ? { sendUserImage: sendUserImageTool } : {}),
      ...(runtime.saveCurrentPhoto ? { saveCurrentPhoto: saveCurrentPhotoTool } : {}),
      ...(runtime.deleteSavedPhotos ? { deleteSavedPhotos: deleteSavedPhotosTool } : {}),
      ...(runtime.scheduleOneOffReminderWorkflow
        ? { scheduleOneOffReminder: scheduleOneOffReminderTool }
        : {}),
    };
  },
});

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: { skintextAgent },
});

export interface RunSkintextAgentInput {
  text: string;
  imageUrl?: string;
  hasImage?: boolean;
}

function buildUserMessage({ text, imageUrl }: RunSkintextAgentInput) {
  if (!imageUrl) {
    return text;
  }
  const imageMarker = text
    ? `${text}\n\n[User attached a skincare/product photo]`
    : "[User sent a skincare/product photo]";

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: imageMarker },
        { type: "image" as const, image: imageUrl },
      ],
    },
  ];
}

export async function runSkintextAgent(input: RunSkintextAgentInput, runtime: SkintextRuntime) {
  const agent = mastra.getAgent("skintextAgent");
  const result = await agent.generate(buildUserMessage(input), {
    requestContext: createSkintextRequestContext(runtime),
    memory: skintextMemoryOptions(runtime.userId, input.hasImage),
    maxSteps: 15,
  });

  if (input.hasImage && !runtime.accountDeleted && !runtime.clearMemoryAfterRun) {
    if (
      runtime.photoRetentionEnabled &&
      runtime.saveCurrentPhoto &&
      !runtime.currentPhotoSaved &&
      !runtime.skipCurrentPhotoRetention
    ) {
      try {
        runtime.currentPhotoSaved = await runtime.saveCurrentPhoto();
      } catch (error) {
        runtime.photoSaveError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  if (runtime.accountDeleted || runtime.clearMemoryAfterRun) {
    await deleteUserMemory(runtime.userId);
  }

  return result;
}
