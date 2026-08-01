import {
  buildOnboardingWorkingMemory,
  initializeUserWorkingMemory,
  processOnboardingMessage,
} from "@skintext/ai";
import {
  createUser,
  deleteAllUserData,
  deleteOnboardingState,
  getOnboardingState,
  setCustomReminderTimes,
  setOnboardingState,
} from "@skintext/db";
import {
  CONSENT_VERSION,
  isOnboardingComplete,
  mergeOnboardingState,
  type OnboardingState,
} from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { errorForLogging } from "@/logging";
import { rejectUnder16PendingOnboarding } from "@/onboarding-eligibility";
import { posthog } from "@/posthog";
import { reminderRunManager } from "@/reminder-runs";

function parseReminderTime(label: string, time?: string) {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { label, hour, minute };
}

function buildReminderTimes(state: OnboardingState) {
  const morning = parseReminderTime("morning", state.morningReminder);
  const evening = parseReminderTime("evening", state.eveningReminder);

  return [morning, evening].filter((time): time is NonNullable<typeof time> => !!time);
}

export async function handleOnboarding(
  log: RequestLogger,
  userId: string,
  text: string,
  phone: string,
  locale: string,
  timezone: string,
  country: string,
): Promise<string[]> {
  if (!text.trim()) return [];

  const raw = await getOnboardingState(userId);
  const isFirstMessage = !raw;
  const state: OnboardingState = raw ?? {};

  if (!state.timezone && timezone) {
    state.timezone = timezone;
  }

  log.set({ onboarding: { isFirstMessage, stateFields: Object.keys(state).length } });
  if (isFirstMessage) {
    posthog?.capture({ event: "onboarding_started" });
  }

  const {
    extracted: modelExtracted,
    nextAction,
    reply,
  } = await processOnboardingMessage(text, state, {
    isFirstMessage,
    timezone,
    locale,
    userId,
  });
  const extracted =
    state.ageEligible !== true && modelExtracted.ageEligible == null
      ? {
          detectedLocale: modelExtracted.detectedLocale,
        }
      : modelExtracted;

  log.set({ onboarding: { extractedFields: Object.keys(extracted), nextAction } });

  if (modelExtracted.ageEligible === false) {
    log.set({ onboarding: { ageEligible: false, accountDeleted: true } });
    posthog?.capture({ event: "underage_onboarding_rejected" });
    const rejected = await rejectUnder16PendingOnboarding({
      extracted: modelExtracted,
      userId,
      reply,
      deletePendingUser: deleteAllUserData,
    });
    if (rejected) return rejected;
  }

  const merged = mergeOnboardingState(state, extracted);
  const diff: Partial<OnboardingState> = {};
  if (!raw?.timezone && timezone) diff.timezone = timezone;
  for (const [k, v] of Object.entries(extracted)) {
    if (v !== undefined && v !== null) {
      (diff as Record<string, unknown>)[k] = v;
    }
  }
  if (extracted.concerns) diff.concerns = merged.concerns;
  if (extracted.goals) diff.goals = merged.goals;
  if (extracted.allergies) diff.allergies = merged.allergies;
  if (extracted.currentProducts) diff.currentProducts = merged.currentProducts;

  diff.lastBotReply = reply;

  await setOnboardingState(userId, diff);

  if (isOnboardingComplete(merged)) {
    log.set({ onboarding: { complete: true } });

    const reminderTimes = buildReminderTimes(merged);
    await createUser(userId, phone, {
      locale: merged.detectedLocale ?? locale,
      timezone: merged.timezone!,
      timezoneConfirmed: merged.timezoneConfirmed === true,
      country,
      styleOfferState: "pending",
      photoRetentionConsentedAt: null,
      photoRetentionConsentVersion: null,
      photoRetentionOfferShownAt: null,
      onboardingComplete: true,
      consentedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });

    posthog?.capture({
      event: "onboarding_completed",
      properties: { has_reminder_times: reminderTimes.length > 0 },
    });

    await initializeUserWorkingMemory(
      userId,
      buildOnboardingWorkingMemory({
        name: merged.name!,
        replyLanguage: merged.detectedLocale ?? locale,
        skinType: merged.skinType ?? "unsure",
        sensitivity: merged.sensitivity ?? "unsure",
        concerns: merged.concerns ?? [],
        goals: merged.goals ?? [],
        allergiesAndAvoids: merged.allergies ?? [],
        currentProducts: merged.currentProducts ?? [],
        routinePreference: merged.routinePreference ?? "simple",
        communicationStyle: "clear_expert",
      }),
    );

    await Promise.all([
      reminderTimes.length > 0 ? setCustomReminderTimes(userId, reminderTimes) : Promise.resolve(),
      deleteOnboardingState(userId),
    ]);

    if (reminderTimes.length > 0) {
      try {
        await reminderRunManager.start(userId);
      } catch (err) {
        log.error(errorForLogging(err));
      }
    }

    return [reply];
  }

  return [reply];
}
