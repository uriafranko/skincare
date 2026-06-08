import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ModelMessage, stepCountIs, type Tool, ToolLoopAgent } from "ai";
import { createRescueCompactionPrepareStep } from "./compaction";
import { createCompactionGatewayModel, createDefaultGatewayModel } from "./models";
import { createDeleteAccountTool, type DeleteAccountData } from "./tools/delete-account";
import { exportDataTool } from "./tools/export-data";
import { getUserProfile } from "./tools/get-profile";
import {
  createScheduleOneOffReminderTool,
  type ScheduleOneOffReminderWorkflow,
} from "./tools/one-off-reminders";
import { listProductsTool, logProductUseTool, saveProductTool } from "./tools/products";
import { recallMemoryTool } from "./tools/recall-memory";
import {
  deleteRoutineEntryTool,
  getTodayRoutineLogTool,
  getWeeklyRoutineLogTool,
  logRoutineStepTool,
} from "./tools/routine";
import { saveMemoryTool } from "./tools/save-memory";
import {
  createSetRemindersTool,
  getRemindersTool,
  type RecurringReminderScheduleSync,
} from "./tools/set-reminders";
import { updateProfileTool } from "./tools/update-profile";
import {
  createSendUserImageTool,
  listUserImagesTool,
  type SendUserImage,
} from "./tools/user-images";

export interface AgentSecurityContext {
  userId: string;
  timezone: string;
}

function withContext<T extends Tool>(t: T, ctx: AgentSecurityContext): T {
  return {
    ...t,
    execute: (args: Record<string, unknown>, options: unknown) =>
      t.execute!({ ...args, userId: ctx.userId, timezone: ctx.timezone }, options as never),
  } as T;
}

interface AgentOptions extends AgentSecurityContext {
  model?: LanguageModelV3;
  compactionModel?: LanguageModelV3;
  scheduleOneOffReminderWorkflow?: ScheduleOneOffReminderWorkflow;
  syncRecurringReminderSchedule?: RecurringReminderScheduleSync;
  sendUserImage?: SendUserImage;
  deleteAccountData?: DeleteAccountData;
}

export function createSkintextAgent(systemPrompt: string, ctx: AgentOptions) {
  const model = ctx.model ?? createDefaultGatewayModel();
  const tools: Record<string, Tool> = {
    logRoutineStep: withContext(logRoutineStepTool, ctx),
    deleteRoutineEntry: withContext(deleteRoutineEntryTool, ctx),
    getTodayRoutineLog: withContext(getTodayRoutineLogTool, ctx),
    getWeeklyRoutineLog: withContext(getWeeklyRoutineLogTool, ctx),
    saveProduct: withContext(saveProductTool, ctx),
    listProducts: withContext(listProductsTool, ctx),
    logProductUse: withContext(logProductUseTool, ctx),
    getUserProfile: withContext(getUserProfile, ctx),
    updateProfile: withContext(updateProfileTool, ctx),
    setReminders: withContext(createSetRemindersTool(ctx.syncRecurringReminderSchedule), ctx),
    getReminders: withContext(getRemindersTool, ctx),
    exportData: withContext(exportDataTool, ctx),
    deleteAccount: withContext(createDeleteAccountTool(ctx.deleteAccountData), ctx),
    saveMemory: withContext(saveMemoryTool, ctx),
    recallMemory: withContext(recallMemoryTool, ctx),
    listUserImages: withContext(listUserImagesTool, ctx),
  };

  if (ctx.sendUserImage) {
    tools.sendUserImage = withContext(createSendUserImageTool(ctx.sendUserImage), ctx);
  }

  if (ctx.scheduleOneOffReminderWorkflow) {
    tools.scheduleOneOffReminder = withContext(
      createScheduleOneOffReminderTool(ctx.scheduleOneOffReminderWorkflow),
      ctx,
    );
  }

  return new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(8),
    prepareStep: createRescueCompactionPrepareStep({
      model: ctx.compactionModel ?? createCompactionGatewayModel(),
      systemPrompt,
    }),
  });
}

export type { ModelMessage };
