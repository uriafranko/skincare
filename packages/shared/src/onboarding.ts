import type { OnboardingFieldKey, OnboardingState } from "./types";

export type OnboardingNextAction =
  | "ask_age"
  | "collect_profile"
  | "ask_timezone"
  | "ask_consent"
  | "complete"
  | "stop_underage";

/**
 * Do not retain skincare profile data until the user has established that they
 * are eligible for onboarding. Locale is safe to retain so the age gate can be
 * answered in the user's language.
 */
export function sanitizeOnboardingExtraction(
  state: OnboardingState,
  extracted: Partial<OnboardingState>,
): Partial<OnboardingState> {
  if (state.ageEligible === true || extracted.ageEligible === true) return extracted;

  return {
    ...(extracted.ageEligible === false ? { ageEligible: false } : {}),
    ...(extracted.detectedLocale ? { detectedLocale: extracted.detectedLocale } : {}),
  };
}

export function getMissingFields(state: OnboardingState): OnboardingFieldKey[] {
  const missing: OnboardingFieldKey[] = [];
  if (state.ageEligible !== true) missing.push("age_eligibility");
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("skin_goals");
  if (!state.skinType && !state.sensitivity) missing.push("skin_profile");
  if ((state.morningReminder || state.eveningReminder) && !state.timezoneConfirmed) {
    missing.push("timezone");
  }
  if (missing.length === 0 && !state.consented) missing.push("consent");
  return missing;
}

/**
 * The product has two modes (onboarding and main). This is not another state
 * machine: it is the single server-derived instruction for the next onboarding
 * reply.
 */
export function getOnboardingNextAction(state: OnboardingState): OnboardingNextAction {
  if (state.ageEligible === false) return "stop_underage";

  const firstMissing = getMissingFields(state)[0];
  if (!firstMissing) return "complete";
  if (firstMissing === "age_eligibility") return "ask_age";
  if (firstMissing === "timezone") return "ask_timezone";
  if (firstMissing === "consent") return "ask_consent";
  return "collect_profile";
}

function mergeList(existing?: readonly string[], incoming?: readonly string[]): string[] {
  return Array.from(
    new Set(
      [...(existing ?? []), ...(incoming ?? [])].map((value) => value.trim()).filter(Boolean),
    ),
  );
}

export function mergeOnboardingState(
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

export function isOnboardingComplete(state: OnboardingState): boolean {
  return getMissingFields(state).length === 0 && state.consented === true;
}
