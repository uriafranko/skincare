import type { OnboardingState } from "@skintext/shared";

export type LocalOnboardingField = "name" | "skin_goals" | "skin_profile" | "consent";

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

export function getMissingOnboardingFields(state: OnboardingState): LocalOnboardingField[] {
  const missing: LocalOnboardingField[] = [];
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("skin_goals");
  if (!state.skinType && !state.sensitivity) missing.push("skin_profile");
  if (missing.length === 0 && !state.consented) missing.push("consent");
  return missing;
}

export function isLocalOnboardingComplete(state: OnboardingState): boolean {
  return getMissingOnboardingFields(state).length === 0 && state.consented === true;
}

export function summarizeOnboardingState(state?: OnboardingState): string {
  if (!state) return "none";

  const parts: string[] = [];
  if (state.name) parts.push(`name=${state.name}`);
  if (state.skinType) parts.push(`skinType=${state.skinType}`);
  if (state.sensitivity) parts.push(`sensitivity=${state.sensitivity}`);
  if (state.concerns?.length) parts.push(`concerns=${state.concerns.join(", ")}`);
  if (state.goals?.length) parts.push(`goals=${state.goals.join(", ")}`);
  if (state.allergies?.length) parts.push(`allergies=${state.allergies.join(", ")}`);
  if (state.currentProducts?.length) parts.push(`products=${state.currentProducts.join(", ")}`);
  if (state.morningReminder) parts.push(`am=${state.morningReminder}`);
  if (state.eveningReminder) parts.push(`pm=${state.eveningReminder}`);
  if (state.consented) parts.push("consent=true");

  return parts.length ? parts.join("; ") : "empty";
}
