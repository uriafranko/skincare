import type { OnboardingState } from "@skintext/shared";
import {
  getMissingFields,
  isOnboardingComplete,
  mergeOnboardingState,
} from "@skintext/shared/onboarding";

export { mergeOnboardingState };
export const getMissingOnboardingFields = getMissingFields;
export const isLocalOnboardingComplete = isOnboardingComplete;

export function summarizeOnboardingState(state?: OnboardingState): string {
  if (!state) return "none";

  const parts: string[] = [];
  if (state.ageEligible === true) parts.push("ageEligible=true");
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
