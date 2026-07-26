import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import type { AgentContext, UserImage } from "@skintext/shared";

export interface SendUserImageInput {
  userId: string;
  image: UserImage;
  caption?: string;
}

export type SendUserImage = (input: SendUserImageInput) => Promise<void>;
export interface SendUiMessageInput {
  userId: string;
  svg: string;
  filename: string;
  width: number;
  height: number;
}

export type SendUiMessage = (input: SendUiMessageInput) => Promise<void>;
export type SaveCurrentPhoto = () => Promise<UserImage>;
export type DeleteSavedPhotos = (userId: string) => Promise<{
  attempted: number;
  deleted: number;
  queued: number;
  errors: number;
}>;
export type DeleteAccountData = (userId: string) => Promise<void>;
export type ScheduleOneOffReminderWorkflow = (input: {
  userId: string;
  reminderId: string;
}) => Promise<{ runId?: string } | string | undefined>;
export type CancelOneOffReminderWorkflow = (input: {
  userId: string;
  reminderId: string;
  workflowRunId: string;
}) => Promise<boolean>;
export type RecurringReminderScheduleSync = (input: {
  userId: string;
  enabled: boolean;
}) => Promise<{ runId?: string } | string | undefined>;

export interface SkintextRuntime {
  userId: string;
  timezone: string;
  inputText: string;
  hasImage: boolean;
  isScheduledEvent: boolean;
  agentContext: AgentContext;
  sendUiMessage?: SendUiMessage;
  sendUserImage?: SendUserImage;
  saveCurrentPhoto?: SaveCurrentPhoto;
  deleteSavedPhotos?: DeleteSavedPhotos;
  deleteAccountData?: DeleteAccountData;
  scheduleOneOffReminderWorkflow?: ScheduleOneOffReminderWorkflow;
  cancelOneOffReminderWorkflow?: CancelOneOffReminderWorkflow;
  syncRecurringReminderSchedule?: RecurringReminderScheduleSync;
  accountDeleted?: boolean;
  clearMemoryAfterRun?: boolean;
  currentPhotoSaved?: UserImage;
  skipCurrentPhotoRetention?: boolean;
  photoRetentionEnabled?: boolean;
  photoSaveError?: string;
}

export interface SkintextRequestContext {
  runtime: SkintextRuntime;
  mastra__resourceId: string;
  mastra__threadId: string;
}

export function createSkintextRequestContext(runtime: SkintextRuntime) {
  const requestContext = new RequestContext<SkintextRequestContext>();
  requestContext.set("runtime", runtime);
  requestContext.set(MASTRA_RESOURCE_ID_KEY, runtime.userId);
  requestContext.set(MASTRA_THREAD_ID_KEY, skintextThreadId(runtime.userId));
  return requestContext;
}

export function skintextThreadId(userId: string): string {
  return `skintext:${userId}`;
}

export function getSkintextRuntime(requestContext?: RequestContext): SkintextRuntime {
  const runtime = requestContext?.get("runtime") as SkintextRuntime | undefined;
  if (!runtime) throw new Error("Skintext runtime is missing from the Mastra request context.");
  return runtime;
}
