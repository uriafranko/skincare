import { openai } from "@ai-sdk/openai";
import { processOnboardingMessage } from "@skintext/ai";
import {
  createUser,
  deleteOnboardingState,
  getOnboardingState,
  saveProduct,
  setCustomReminderTimes,
  setOnboardingState,
  setReminderRunId,
} from "@skintext/db";
import type { OnboardingState } from "@skintext/shared";
import { CONSENT_VERSION, generateId, isOnboardingComplete, ROUTINE_TIMES } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { createAILogger } from "evlog/ai";
import { start } from "workflow/api";
import { reminderLoop } from "../../workflows/reminder-loop";

function mergeList(existing?: string[], incoming?: string[]): string[] {
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

  if (!morning && !evening) return [];

  return ROUTINE_TIMES.map((routine) => {
    const custom =
      routine.label === "morning" ? morning : routine.label === "evening" ? evening : null;

    return {
      label: routine.label,
      hour: custom?.hour ?? routine.hour,
      minute: custom?.minute ?? routine.minute,
    };
  });
}

function saveInitialProducts(userId: string, products: string[]) {
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
    state.timezoneConfirmed = true;
  }

  const ai = createAILogger(log);
  const model = ai.wrap(openai("gpt-4.1-mini"));

  log.set({ onboarding: { isFirstMessage, stateFields: Object.keys(state).length } });

  const { extracted, reply } = await processOnboardingMessage(
    text,
    state,
    {
      isFirstMessage,
      timezone,
      locale,
    },
    model,
  );

  log.set({ onboarding: { extractedFields: Object.keys(extracted) } });

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

    const { reply: welcomeReply } = await processOnboardingMessage(
      text,
      merged,
      {
        isFirstMessage: false,
        timezone,
        locale,
        complete: true,
      },
      model,
    );

    const reminderTimes = buildReminderTimes(merged);
    const currentProducts = merged.currentProducts ?? [];

    await createUser(userId, encryptedPhone, {
      name: merged.name!,
      locale: merged.detectedLocale ?? locale,
      timezone: merged.timezone!,
      country,
      skinType: merged.skinType ?? "unsure",
      sensitivity: merged.sensitivity ?? "unsure",
      concerns: merged.concerns ?? [],
      goals: merged.goals ?? [],
      allergies: merged.allergies ?? [],
      currentProducts: merged.currentProducts ?? [],
      routinePreference: merged.routinePreference ?? "simple",
      onboardingComplete: true,
      consentedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
    });

    await Promise.all([
      ...saveInitialProducts(userId, currentProducts),
      reminderTimes.length > 0 ? setCustomReminderTimes(userId, reminderTimes) : Promise.resolve(),
      deleteOnboardingState(userId),
    ]);

    try {
      const run = await start(reminderLoop, [userId]);
      await setReminderRunId(userId, run.runId);
    } catch (err) {
      log.error(err as Error);
    }

    return [welcomeReply];
  }

  return [reply];
}
