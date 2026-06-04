import type {
  OnboardingState,
  RoutinePreference,
  SensitivityLevel,
  SkinType,
} from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { onboardingStates } from "./schema";

const TTL_24H = 60 * 60 * 24;
const encryptedFields = new Set([
  "name",
  "concerns",
  "goals",
  "allergies",
  "currentProducts",
  "lastBotReply",
]);

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
  if (d.name) result.name = await decrypt(String(d.name));
  if (d.timezoneConfirmed === true) result.timezoneConfirmed = true;
  if (d.timezone) result.timezone = String(d.timezone);
  if (d.skinType) result.skinType = String(d.skinType) as SkinType;
  if (d.sensitivity) result.sensitivity = String(d.sensitivity) as SensitivityLevel;
  if (d.concerns) result.concerns = parseList(await decrypt(String(d.concerns)));
  if (d.goals) result.goals = parseList(await decrypt(String(d.goals)));
  if (d.allergies) result.allergies = parseList(await decrypt(String(d.allergies)));
  if (d.currentProducts) {
    result.currentProducts = parseList(await decrypt(String(d.currentProducts)));
  }
  if (d.routinePreference)
    result.routinePreference = String(d.routinePreference) as RoutinePreference;
  if (d.morningReminder) result.morningReminder = String(d.morningReminder);
  if (d.eveningReminder) result.eveningReminder = String(d.eveningReminder);
  if (d.consented === true) result.consented = true;
  if (d.detectedLocale) result.detectedLocale = String(d.detectedLocale);
  if (d.lastBotReply) result.lastBotReply = await decrypt(String(d.lastBotReply));
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
    const stored = encryptedFields.has(k) ? await encryptContent(value) : value;
    switch (k) {
      case "name":
        flat.name = stored;
        break;
      case "timezoneConfirmed":
        flat.timezoneConfirmed = v === true;
        break;
      case "timezone":
        flat.timezone = stored;
        break;
      case "skinType":
        flat.skinType = stored;
        break;
      case "sensitivity":
        flat.sensitivity = stored;
        break;
      case "concerns":
        flat.concerns = stored;
        break;
      case "goals":
        flat.goals = stored;
        break;
      case "allergies":
        flat.allergies = stored;
        break;
      case "currentProducts":
        flat.currentProducts = stored;
        break;
      case "routinePreference":
        flat.routinePreference = stored;
        break;
      case "morningReminder":
        flat.morningReminder = stored;
        break;
      case "eveningReminder":
        flat.eveningReminder = stored;
        break;
      case "consented":
        flat.consented = v === true;
        break;
      case "detectedLocale":
        flat.detectedLocale = stored;
        break;
      case "lastBotReply":
        flat.lastBotReply = stored;
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
