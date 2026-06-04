import type {
  OnboardingState,
  RoutinePreference,
  SensitivityLevel,
  SkinType,
} from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { getRedis } from "./client";

const onboardingKey = (userId: string) => `onboarding:${userId}`;
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
  const redis = getRedis();
  const data = await redis.hgetall(onboardingKey(userId));
  if (!data || Object.keys(data).length === 0) return null;
  const d = data as Record<string, unknown>;
  const result: OnboardingState = {};
  if (d.name) result.name = await decrypt(String(d.name));
  if (String(d.timezoneConfirmed) === "true") result.timezoneConfirmed = true;
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
  if (String(d.consented) === "true") result.consented = true;
  if (d.detectedLocale) result.detectedLocale = String(d.detectedLocale);
  if (d.lastBotReply) result.lastBotReply = await decrypt(String(d.lastBotReply));
  return result;
}

export async function setOnboardingState(
  userId: string,
  state: Partial<OnboardingState>,
): Promise<void> {
  const redis = getRedis();
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(state)) {
    if (v === undefined) continue;
    const value = Array.isArray(v) ? JSON.stringify(v) : String(v);
    flat[k] = encryptedFields.has(k) ? await encryptContent(value) : value;
  }
  const key = onboardingKey(userId);
  const pipeline = redis.pipeline();
  pipeline.hset(key, flat);
  pipeline.expire(key, TTL_24H);
  await pipeline.exec();
}

export async function deleteOnboardingState(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(onboardingKey(userId));
}
