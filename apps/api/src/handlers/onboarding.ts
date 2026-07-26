import { processOnboardingMessage } from "@skintext/ai";
import {
  createUser,
  deleteAllUserData,
  deleteOnboardingState,
  getOnboardingState,
  saveProduct,
  setCustomReminderTimes,
  setOnboardingState,
  setReminderRunId,
} from "@skintext/db";
import type { OnboardingState } from "@skintext/shared";
import { CONSENT_VERSION, generateId, isOnboardingComplete } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { start } from "workflow/api";
import { rejectUnder16PendingOnboarding } from "@/onboarding-eligibility";
import { reminderLoop } from "../../workflows/reminder-loop";

function mergeList(existing?: readonly string[], incoming?: readonly string[]): string[] {
  return Array.from(
    new Set(
      [...(existing ?? []), ...(incoming ?? [])].map((value) => value.trim()).filter(Boolean),
    ),
  );
}

function mergeOnboardingState(
  state: OnboardingState,
  extracted: Partial<OnboardingState>,
): OnboardingState {
  return {
    ...state,
    ...extracted,
    concerns: mergeList(state.concerns, extracted.concerns),
    goals: mergeList(state.goals, extracted.goals),
    allergies: mergeList(state.allergies, extracted.allergies),
    currentProducts: mergeList(state.currentProducts, extracted.currentProducts),
  };
}

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

function saveInitialProducts(userId: string, products: readonly string[]) {
  const createdAt = new Date().toISOString();
  return products.map((name) =>
    saveProduct({
      id: generateId("prod"),
      userId,
      name,
      source: "text",
      createdAt,
    }),
  );
}

export async function handleOnboarding(
  log: RequestLogger,
  userId: string,
  text: string,
  encryptedPhone: string,
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

  const { extracted: modelExtracted, reply } = await processOnboardingMessage(text, state, {
    isFirstMessage,
    timezone,
    locale,
  });
  const extracted =
    state.ageEligible !== true && modelExtracted.ageEligible == null
      ? {
          detectedLocale: modelExtracted.detectedLocale,
        }
      : modelExtracted;

  log.set({ onboarding: { extractedFields: Object.keys(extracted) } });

  if (modelExtracted.ageEligible === false) {
    log.set({ onboarding: { ageEligible: false, accountDeleted: true } });
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

    const { reply: welcomeReply } = await processOnboardingMessage(text, merged, {
      isFirstMessage: false,
      timezone,
      locale,
      complete: true,
    });

    const reminderTimes = buildReminderTimes(merged);
    const currentProducts = merged.currentProducts ?? [];

    await createUser(userId, encryptedPhone, {
      name: merged.name!,
      locale: merged.detectedLocale ?? locale,
      timezone: merged.timezone!,
      timezoneConfirmed: merged.timezoneConfirmed === true,
      country,
      skinType: merged.skinType ?? "unsure",
      sensitivity: merged.sensitivity ?? "unsure",
      concerns: [...(merged.concerns ?? [])],
      goals: [...(merged.goals ?? [])],
      allergies: [...(merged.allergies ?? [])],
      currentProducts: [...(merged.currentProducts ?? [])],
      routinePreference: merged.routinePreference ?? "simple",
      communicationStyle: "clear_expert",
      styleOfferState: "pending",
      photoRetentionConsentedAt: null,
      photoRetentionConsentVersion: null,
      photoRetentionOfferShownAt: null,
      onboardingComplete: true,
      consentedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });

    await Promise.all([
      ...saveInitialProducts(userId, currentProducts),
      reminderTimes.length > 0 ? setCustomReminderTimes(userId, reminderTimes) : Promise.resolve(),
      deleteOnboardingState(userId),
    ]);

    if (reminderTimes.length > 0) {
      try {
        const run = await start(reminderLoop, [userId]);
        await setReminderRunId(userId, run.runId);
      } catch (err) {
        log.error(err as Error);
      }
    }

    return [welcomeReply];
  }

  return [reply];
}
