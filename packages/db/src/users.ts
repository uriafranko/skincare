import type { RoutinePreference, SensitivityLevel, SkinType, UserProfile } from "@skintext/shared";
import { getRedis } from "./client";

const userKey = (userId: string) => `user:${userId}`;
const phoneIndexKey = (encryptedPhone: string) => `phone:${encryptedPhone}`;

function parseList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function stringifyList(value: string[]): string {
  return JSON.stringify(value);
}

export async function resolveUserId(encryptedPhone: string): Promise<string | null> {
  const redis = getRedis();
  return await redis.get<string>(phoneIndexKey(encryptedPhone));
}

export async function createPhoneMapping(encryptedPhone: string, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(phoneIndexKey(encryptedPhone), userId);
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const redis = getRedis();
  const data = await redis.hgetall(userKey(userId));
  if (!data || Object.keys(data).length === 0) return null;
  const d = data as Record<string, unknown>;
  return {
    id: userId,
    phone: String(d.phone ?? ""),
    name: String(d.name ?? ""),
    locale: String(d.locale ?? "en"),
    timezone: String(d.timezone ?? "UTC"),
    country: String(d.country ?? "US"),
    skinType: String(d.skinType ?? "unsure") as SkinType,
    sensitivity: String(d.sensitivity ?? "unsure") as SensitivityLevel,
    concerns: parseList(d.concerns),
    goals: parseList(d.goals),
    allergies: parseList(d.allergies),
    currentProducts: parseList(d.currentProducts),
    routinePreference: String(d.routinePreference ?? "simple") as RoutinePreference,
    onboardingComplete: String(d.onboardingComplete) === "true",
    consentedAt: d.consentedAt ? String(d.consentedAt) : null,
    consentVersion: d.consentVersion ? String(d.consentVersion) : null,
    createdAt: String(d.createdAt ?? new Date().toISOString()),
  };
}

export async function createUser(
  userId: string,
  encryptedPhone: string,
  profile: Omit<UserProfile, "id" | "phone" | "createdAt">,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(userKey(userId), {
    phone: encryptedPhone,
    name: profile.name,
    locale: profile.locale,
    timezone: profile.timezone,
    country: profile.country,
    skinType: profile.skinType,
    sensitivity: profile.sensitivity,
    concerns: stringifyList(profile.concerns),
    goals: stringifyList(profile.goals),
    allergies: stringifyList(profile.allergies),
    currentProducts: stringifyList(profile.currentProducts),
    routinePreference: profile.routinePreference,
    onboardingComplete: String(profile.onboardingComplete),
    consentedAt: profile.consentedAt ?? "",
    consentVersion: profile.consentVersion ?? "",
    createdAt: new Date().toISOString(),
  });
}

export async function updateUser(
  userId: string,
  fields: Partial<Record<string, string>>,
): Promise<void> {
  const redis = getRedis();
  await redis.hset(userKey(userId), fields);
}

export async function userExists(userId: string): Promise<boolean> {
  const redis = getRedis();
  return (await redis.exists(userKey(userId))) === 1;
}

export async function withdrawConsent(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.hset(userKey(userId), { consentedAt: "", consentVersion: "" });
}

export async function deleteAllUserData(userId: string): Promise<void> {
  const redis = getRedis();

  const user = await getUser(userId);
  const keysToDelete: string[] = [
    userKey(userId),
    `routine_streak:${userId}`,
    `memory:${userId}`,
    `messages:${userId}`,
    `products:${userId}`,
    `reminder:${userId}`,
    `reminder_times:${userId}`,
    `one_off_reminders:${userId}`,
    `onboarding:${userId}`,
    `export:${userId}`,
  ];

  if (user?.phone) {
    keysToDelete.push(phoneIndexKey(user.phone));
  }

  let cursor = "0";
  do {
    const [nextCursor, keys] = (await redis.scan(Number(cursor), {
      match: `routine_logs:${userId}:*`,
      count: 100,
    })) as unknown as [string, string[]];
    cursor = nextCursor;
    for (const key of keys) {
      const entryIds = await redis.zrange<string[]>(key, 0, -1);
      for (const entryId of entryIds ?? []) {
        keysToDelete.push(`routine_entry:${entryId}`);
      }
      keysToDelete.push(key);
    }
  } while (cursor !== "0");

  if (keysToDelete.length > 0) {
    const pipeline = redis.pipeline();
    for (const key of keysToDelete) {
      pipeline.del(key);
    }
    await pipeline.exec();
  }
}
