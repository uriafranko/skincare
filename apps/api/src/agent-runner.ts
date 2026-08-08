import type { SkintextMessageSource, SkintextRuntime } from "@skintext/ai";
import {
  deriveMinimumRiskState,
  runSkintextAgent,
  saveSanitizedImageTurn,
  shouldOfferCommunicationStyle,
  shouldOfferPhotoRetention,
} from "@skintext/ai";
import { getAdherenceStreak, updateUser } from "@skintext/db";
import type { AgentContext, UserAccount } from "@skintext/shared";
import { getLocaleName, localDateString, PERSONALITY_POLICY_VERSION } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { errorForLogging } from "@/logging";

type RuntimeService =
  | "sendUiMessage"
  | "sendUserImage"
  | "inspectUserImage"
  | "saveCurrentPhoto"
  | "deleteSavedPhotos"
  | "deleteAccountData"
  | "scheduleOneOffReminderWorkflow"
  | "cancelOneOffReminderWorkflow"
  | "syncRecurringReminderSchedule";

export type RunAgentMessageOptions = Pick<SkintextRuntime, RuntimeService> & {
  imageUrl?: string;
  source?: SkintextMessageSource;
};

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

function suspendedToolMessage(suspendPayload: unknown): string | null {
  if (!suspendPayload || typeof suspendPayload !== "object") return null;
  const payload = suspendPayload as {
    message?: unknown;
    suspendPayload?: unknown;
    toolCallSuspended?: unknown;
  };
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return (
    suspendedToolMessage(payload.toolCallSuspended) ?? suspendedToolMessage(payload.suspendPayload)
  );
}

// Single main-agent entrypoint for inbound user texts and scheduled reminder events.
export async function runAgentMessage(
  log: RequestLogger,
  user: UserAccount,
  text: string,
  options: RunAgentMessageOptions = {},
): Promise<string | null> {
  const localDate = localDateString(user.timezone);
  const streak = await getAdherenceStreak(user.id);
  const hasImage = !!options.imageUrl;
  const source = options.source ?? "user";
  const isScheduledEvent = source === "scheduled";
  const riskState = deriveMinimumRiskState(text, source);
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
    consented: !!user.photoRetentionConsentedAt,
    offerShown: !!user.photoRetentionOfferShownAt,
  });

  log.set({
    context: {
      hasImage,
      policyVersion: PERSONALITY_POLICY_VERSION,
      riskState,
      personalizationSource: "working_memory",
    },
  });

  const agentContext: AgentContext = {
    userId: user.id,
    localeName: getLocaleName(user.locale),
    locale: user.locale,
    timezone: user.timezone,
    localDate,
    userAccount: user,
    riskState,
    shouldOfferStyle,
    shouldOfferPhotoRetention: offerPhotoRetention,
    hasImage,
    isScheduledEvent,
    streak: streak.current > 0 ? streak.current : null,
  };
  const runtime: SkintextRuntime = {
    agentContext,
    sendUiMessage: options.sendUiMessage,
    sendUserImage: options.sendUserImage,
    inspectUserImage: options.inspectUserImage,
    saveCurrentPhoto: options.saveCurrentPhoto,
    deleteSavedPhotos: options.deleteSavedPhotos,
    deleteAccountData: options.deleteAccountData,
    scheduleOneOffReminderWorkflow: options.scheduleOneOffReminderWorkflow,
    cancelOneOffReminderWorkflow: options.cancelOneOffReminderWorkflow,
    syncRecurringReminderSchedule: options.syncRecurringReminderSchedule,
    photoRetentionEnabled: !!user.photoRetentionConsentedAt,
  };

  const result = await runSkintextAgent({ text, imageUrl: options.imageUrl }, runtime);
  if (!result) {
    log.set({ agent: { signal: "delivered_to_active_run" } });
    return null;
  }
  const resultText = result.text || suspendedToolMessage(result.suspendPayload);
  if (shouldOfferStyle && resultText && user.styleOfferState === "pending") {
    await updateUser(user.id, { styleOfferState: "shown" });
    user.styleOfferState = "shown";
  }
  if (offerPhotoRetention && resultText) {
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
      styleSource: "working_memory",
      riskState,
      photoRetentionEnabled: runtime.photoRetentionEnabled ?? false,
      photoRetained: !!runtime.currentPhotoSaved,
      photoRetentionError: !!runtime.photoSaveError,
    },
  });

  if (!resultText) return null;
  const reply = runtime.photoSaveError
    ? `${resultText}\n\n${photoSaveFailureReply(user.locale)}`
    : resultText;
  if (hasImage && !runtime.accountDeleted) {
    try {
      await saveSanitizedImageTurn({
        resourceId: user.id,
        userText: text,
        assistantText: reply,
        retainedPhoto: runtime.currentPhotoSaved,
      });
    } catch (error) {
      log.error(errorForLogging(error));
      log.set({ personality: { sanitizedHistorySaved: false } });
    }
  }
  return reply;
}
