import { openai } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { type ModelMessage, stepCountIs, type Tool, ToolLoopAgent } from "ai";
import { createRescueCompactionPrepareStep, getCompactionModelName } from "./compaction";
import { createAnalyzeSkincareImageTool } from "./tools/analyze-skincare-image";
import { deleteAccountTool } from "./tools/delete-account";
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
import { getRemindersTool, setRemindersTool } from "./tools/set-reminders";
import { updateProfileTool } from "./tools/update-profile";

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

export interface AgentOptions extends AgentSecurityContext {
  hasImage?: boolean;
  imageUrl?: string;
  model?: LanguageModelV3;
  compactionModel?: LanguageModelV3;
  scheduleOneOffReminderWorkflow?: ScheduleOneOffReminderWorkflow;
}

export function createSkintextAgent(systemPrompt: string, ctx: AgentOptions) {
  const model = ctx.model ?? openai(ctx.hasImage ? "gpt-4.1" : "gpt-4.1-mini");
  const tools: Record<string, Tool> = {
    analyzeSkincareImage: createAnalyzeSkincareImageTool(ctx.imageUrl),
    logRoutineStep: withContext(logRoutineStepTool, ctx),
    deleteRoutineEntry: withContext(deleteRoutineEntryTool, ctx),
    getTodayRoutineLog: withContext(getTodayRoutineLogTool, ctx),
    getWeeklyRoutineLog: withContext(getWeeklyRoutineLogTool, ctx),
    saveProduct: withContext(saveProductTool, ctx),
    listProducts: withContext(listProductsTool, ctx),
    logProductUse: withContext(logProductUseTool, ctx),
    getUserProfile: withContext(getUserProfile, ctx),
    updateProfile: withContext(updateProfileTool, ctx),
    setReminders: withContext(setRemindersTool, ctx),
    getReminders: withContext(getRemindersTool, ctx),
    exportData: withContext(exportDataTool, ctx),
    deleteAccount: withContext(deleteAccountTool, ctx),
    saveMemory: withContext(saveMemoryTool, ctx),
    recallMemory: withContext(recallMemoryTool, ctx),
  };

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
      model: ctx.compactionModel ?? openai(getCompactionModelName()),
      systemPrompt,
    }),
  });
}

export type { ModelMessage };
