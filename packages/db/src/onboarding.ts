import type {
  OnboardingState,
  RoutinePreference,
  SensitivityLevel,
  SkinType,
} from "@skintext/shared";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { onboardingStates } from "./schema";

const TTL_24H = 60 * 60 * 24;

function parseList(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const d = await getDb().query.onboardingStates.findFirst({
    where: eq(onboardingStates.userId, userId),
  });
  if (!d) return null;
  if (d.expiresAt.getTime() <= Date.now()) {
    await deleteOnboardingState(userId);
    return null;
  }

  const result: OnboardingState = {};
  if (d.ageEligible === true) result.ageEligible = true;
  if (d.name) result.name = String(d.name);
  if (d.timezoneConfirmed === true) result.timezoneConfirmed = true;
  if (d.timezone) result.timezone = String(d.timezone);
  if (d.skinType) result.skinType = String(d.skinType) as SkinType;
  if (d.sensitivity) result.sensitivity = String(d.sensitivity) as SensitivityLevel;
  if (d.concerns) result.concerns = parseList(String(d.concerns));
  if (d.goals) result.goals = parseList(String(d.goals));
  if (d.allergies) result.allergies = parseList(String(d.allergies));
  if (d.currentProducts) {
    result.currentProducts = parseList(String(d.currentProducts));
  }
  if (d.routinePreference)
    result.routinePreference = String(d.routinePreference) as RoutinePreference;
  if (d.morningReminder) result.morningReminder = String(d.morningReminder);
  if (d.eveningReminder) result.eveningReminder = String(d.eveningReminder);
  if (d.consented === true) result.consented = true;
  if (d.detectedLocale) result.detectedLocale = String(d.detectedLocale);
  if (d.lastBotReply) result.lastBotReply = String(d.lastBotReply);
  return result;
}

export async function setOnboardingState(
  userId: string,
  state: Partial<OnboardingState>,
): Promise<void> {
  const flat: Partial<typeof onboardingStates.$inferInsert> = {};
  for (const [k, v] of Object.entries(state)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? JSON.stringify(v) : String(v);
    switch (k) {
      case "ageEligible":
        flat.ageEligible = v === true;
        break;
      case "name":
        flat.name = value;
        break;
      case "timezoneConfirmed":
        flat.timezoneConfirmed = v === true;
        break;
      case "timezone":
        flat.timezone = value;
        break;
      case "skinType":
        flat.skinType = value;
        break;
      case "sensitivity":
        flat.sensitivity = value;
        break;
      case "concerns":
        flat.concerns = value;
        break;
      case "goals":
        flat.goals = value;
        break;
      case "allergies":
        flat.allergies = value;
        break;
      case "currentProducts":
        flat.currentProducts = value;
        break;
      case "routinePreference":
        flat.routinePreference = value;
        break;
      case "morningReminder":
        flat.morningReminder = value;
        break;
      case "eveningReminder":
        flat.eveningReminder = value;
        break;
      case "consented":
        flat.consented = v === true;
        break;
      case "detectedLocale":
        flat.detectedLocale = value;
        break;
      case "lastBotReply":
        flat.lastBotReply = value;
        break;
    }
  }
  if (Object.keys(flat).length === 0) return;

  const expiresAt = new Date(Date.now() + TTL_24H * 1000);
  await getDb()
    .insert(onboardingStates)
    .values({ userId, ...flat, expiresAt, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: onboardingStates.userId,
      set: { ...flat, expiresAt, updatedAt: new Date() },
    });
}

export async function deleteOnboardingState(userId: string): Promise<void> {
  await getDb().delete(onboardingStates).where(eq(onboardingStates.userId, userId));
}
