import type { OnboardingState } from "@skintext/shared";

export async function rejectUnder16PendingOnboarding(input: {
  extracted: Partial<OnboardingState>;
  userId: string;
  reply: string;
  deletePendingUser: (userId: string) => Promise<void>;
}): Promise<string[] | null> {
  if (input.extracted.ageEligible !== false) return null;
  await input.deletePendingUser(input.userId);
  return [input.reply];
}
