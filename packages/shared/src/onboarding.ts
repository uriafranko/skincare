import type { OnboardingFieldKey, OnboardingState } from "./types";

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
