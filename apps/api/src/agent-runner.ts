import type {
  CancelOneOffReminderWorkflow,
  DeleteAccountData,
  DeleteSavedPhotos,
  RecurringReminderScheduleSync,
  SaveCurrentPhoto,
  ScheduleOneOffReminderWorkflow,
  SendUiMessage,
  SendUserImage,
  SkintextRuntime,
} from "@skintext/ai";
import {
  deriveMinimumRiskState,
  runSkintextAgent,
  saveSanitizedImageTurn,
  shouldOfferCommunicationStyle,
  shouldOfferPhotoRetention,
  USER_REMINDER_OPEN_TAG,
} from "@skintext/ai";
import {
  getActiveRoutineExperiment,
  getAdherenceStreak,
  getAllProducts,
  updateUser,
} from "@skintext/db";
import type { AgentContext, UserProfile } from "@skintext/shared";
import { getLocaleName, localDateString, PERSONALITY_POLICY_VERSION } from "@skintext/shared";
import type { RequestLogger } from "evlog";

export interface RunAgentMessageOptions {
  imageUrl?: string;
  hasImage?: boolean;
  sendUiMessage?: SendUiMessage;
  sendUserImage?: SendUserImage;
  saveCurrentPhoto?: SaveCurrentPhoto;
  deleteSavedPhotos?: DeleteSavedPhotos;
  deleteAccountData?: DeleteAccountData;
  scheduleOneOffReminderWorkflow?: ScheduleOneOffReminderWorkflow;
  cancelOneOffReminderWorkflow?: CancelOneOffReminderWorkflow;
  syncRecurringReminderSchedule?: RecurringReminderScheduleSync;
}

function photoSaveFailureReply(locale: string): string {
  const language = locale.toLowerCase();
  if (language.startsWith("he")) {
    return "לא הצלחתי לשמור את התמונה למעקב. היא עדיין שימשה לתשובה הזאת, אבל לא נשמרה.";
  }
  if (language.startsWith("sv")) {
    return "Jag kunde inte spara bilden för uppföljning. Den användes fortfarande för det här svaret, men sparades inte.";
  }
  return "I couldn't save the photo for tracking. It was still used for this reply, but it wasn't retained.";
}

// Single main-agent entrypoint for inbound user texts and scheduled reminder events.
export async function runAgentMessage(
  log: RequestLogger,
  user: UserProfile,
  text: string,
  options: RunAgentMessageOptions = {},
): Promise<string | null> {
  const [streak, products, activeExperiment] = await Promise.all([
    getAdherenceStreak(user.id),
    getAllProducts(user.id),
    getActiveRoutineExperiment(user.id),
  ]);
  const localDate = localDateString(user.timezone);
  const hasImage = options.hasImage ?? !!options.imageUrl;
  const isScheduledEvent = text.includes(USER_REMINDER_OPEN_TAG);
  const riskState = deriveMinimumRiskState(text);
  const shouldOfferStyle = shouldOfferCommunicationStyle({
    text,
    hasImage,
    isScheduledEvent,
    riskState,
    offerState: user.styleOfferState,
  });
  const offerPhotoRetention = shouldOfferPhotoRetention({
    text,
    hasImage,
    riskState,
    ageBand: user.ageBand,
    consented: !!user.photoRetentionConsentedAt,
    offerShown: !!user.photoRetentionOfferShownAt,
  });

  log.set({
    context: {
      hasImage,
      policyVersion: PERSONALITY_POLICY_VERSION,
      riskState,
      communicationStyle: user.communicationStyle,
      ageBand: user.ageBand,
      activeExperiment: !!activeExperiment,
    },
  });

  const agentContext: AgentContext = {
    userId: user.id,
    userName: user.name,
    localeName: getLocaleName(user.locale),
    locale: user.locale,
    timezone: user.timezone,
    localDate,
    userProfile: user,
    riskState,
    shouldOfferStyle,
    shouldOfferPhotoRetention: offerPhotoRetention,
    hasImage,
    isScheduledEvent,
    activeExperiment,
    streak: streak.current > 0 ? streak.current : null,
    products,
  };
  const runtime: SkintextRuntime = {
    userId: user.id,
    timezone: user.timezone,
    inputText: text,
    hasImage,
    isScheduledEvent,
    agentContext,
    sendUiMessage: options.sendUiMessage,
    sendUserImage: options.sendUserImage,
    saveCurrentPhoto: options.saveCurrentPhoto,
    deleteSavedPhotos: options.deleteSavedPhotos,
    deleteAccountData: options.deleteAccountData,
    scheduleOneOffReminderWorkflow: options.scheduleOneOffReminderWorkflow,
    cancelOneOffReminderWorkflow: options.cancelOneOffReminderWorkflow,
    syncRecurringReminderSchedule: options.syncRecurringReminderSchedule,
    photoRetentionEnabled: user.ageBand !== "16_17" && !!user.photoRetentionConsentedAt,
  };

  const result = await runSkintextAgent({ text, imageUrl: options.imageUrl, hasImage }, runtime);
  if (shouldOfferStyle && result.text && user.styleOfferState === "pending") {
    await updateUser(user.id, { styleOfferState: "shown" });
    user.styleOfferState = "shown";
  }
  if (offerPhotoRetention && result.text) {
    const offeredAt = new Date().toISOString();
    await updateUser(user.id, { photoRetentionOfferShownAt: offeredAt });
    user.photoRetentionOfferShownAt = offeredAt;
  }
  log.set({
    usage: {
      inputTokens: result.totalUsage.inputTokens,
      outputTokens: result.totalUsage.outputTokens,
      totalTokens: result.totalUsage.totalTokens,
      cacheReadTokens: result.totalUsage.cachedInputTokens,
      cacheWriteTokens: result.totalUsage.cacheCreationInputTokens,
    },
    agent: {
      runId: result.runId,
      traceId: result.traceId,
      steps: result.steps.length,
    },
    personality: {
      policyVersion: PERSONALITY_POLICY_VERSION,
      style: user.communicationStyle,
      riskState,
      ageBand: user.ageBand,
      activeExperiment: !!activeExperiment,
      photoRetentionEnabled: runtime.photoRetentionEnabled ?? false,
      photoRetained: !!runtime.currentPhotoSaved,
      photoRetentionError: !!runtime.photoSaveError,
    },
  });

  if (!result.text) return null;
  const reply = runtime.photoSaveError
    ? `${result.text}\n\n${photoSaveFailureReply(user.locale)}`
    : result.text;
  if (hasImage && !runtime.accountDeleted && !runtime.clearMemoryAfterRun) {
    try {
      await saveSanitizedImageTurn({
        resourceId: user.id,
        userText: text,
        assistantText: reply,
      });
    } catch (error) {
      log.error(error as Error);
      log.set({ personality: { sanitizedHistorySaved: false } });
    }
  }
  return reply;
}
