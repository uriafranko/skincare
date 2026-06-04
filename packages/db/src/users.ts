import type { RoutinePreference, SensitivityLevel, SkinType, UserProfile } from "@skintext/shared";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { phoneMappings, users } from "./schema";

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
  const row = await getDb().query.phoneMappings.findFirst({
    where: eq(phoneMappings.encryptedPhone, encryptedPhone),
  });
  return row?.userId ?? null;
}

export async function createPhoneMapping(encryptedPhone: string, userId: string): Promise<void> {
  await getDb().insert(phoneMappings).values({ encryptedPhone, userId }).onConflictDoUpdate({
    target: phoneMappings.encryptedPhone,
    set: { userId },
  });
}

function pendingUserValues(
  userId: string,
  encryptedPhone: string,
  profile: Pick<UserProfile, "locale" | "timezone" | "country">,
): typeof users.$inferInsert {
  return {
    id: userId,
    phone: encryptedPhone,
    name: "",
    locale: profile.locale,
    timezone: profile.timezone,
    country: profile.country,
    skinType: "unsure",
    sensitivity: "unsure",
    concerns: stringifyList([]),
    goals: stringifyList([]),
    allergies: stringifyList([]),
    currentProducts: stringifyList([]),
    routinePreference: "simple",
    onboardingComplete: false,
    consentedAt: null,
    consentVersion: null,
    createdAt: new Date().toISOString(),
  };
}

export async function createPendingUserForPhone(
  userId: string,
  encryptedPhone: string,
  profile: Pick<UserProfile, "locale" | "timezone" | "country">,
): Promise<string> {
  const db = getDb();
  const [inserted] = await db
    .insert(users)
    .values(pendingUserValues(userId, encryptedPhone, profile))
    .onConflictDoNothing()
    .returning({ id: users.id });

  const resolvedUserId =
    inserted?.id ??
    (
      await db.query.users.findFirst({
        columns: { id: true },
        where: eq(users.phone, encryptedPhone),
      })
    )?.id;

  if (!resolvedUserId) {
    throw new Error("Unable to create or resolve pending user for phone.");
  }

  await db
    .insert(phoneMappings)
    .values({ encryptedPhone, userId: resolvedUserId })
    .onConflictDoUpdate({
      target: phoneMappings.encryptedPhone,
      set: { userId: resolvedUserId },
    });

  return resolvedUserId;
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const d = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!d) return null;
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
  const createdAt = new Date().toISOString();
  await getDb()
    .insert(users)
    .values({
      id: userId,
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
      onboardingComplete: profile.onboardingComplete,
      consentedAt: profile.consentedAt,
      consentVersion: profile.consentVersion,
      createdAt,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
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
        onboardingComplete: profile.onboardingComplete,
        consentedAt: profile.consentedAt,
        consentVersion: profile.consentVersion,
      },
    });
  await createPhoneMapping(encryptedPhone, userId);
}

export async function updateUser(
  userId: string,
  fields: Partial<Record<string, string>>,
): Promise<void> {
  const updates: Partial<typeof users.$inferInsert> = {};

  for (const [key, value] of Object.entries(fields)) {
    switch (key) {
      case "phone":
        updates.phone = value;
        break;
      case "name":
        updates.name = value;
        break;
      case "locale":
        updates.locale = value;
        break;
      case "timezone":
        updates.timezone = value;
        break;
      case "country":
        updates.country = value;
        break;
      case "skinType":
        updates.skinType = value;
        break;
      case "sensitivity":
        updates.sensitivity = value;
        break;
      case "concerns":
        updates.concerns = value;
        break;
      case "goals":
        updates.goals = value;
        break;
      case "allergies":
        updates.allergies = value;
        break;
      case "currentProducts":
        updates.currentProducts = value;
        break;
      case "routinePreference":
        updates.routinePreference = value;
        break;
      case "onboardingComplete":
        updates.onboardingComplete = value === "true";
        break;
      case "consentedAt":
        updates.consentedAt = value || null;
        break;
      case "consentVersion":
        updates.consentVersion = value || null;
        break;
      case "createdAt":
        updates.createdAt = value;
        break;
    }
  }

  if (Object.keys(updates).length === 0) return;
  await getDb().update(users).set(updates).where(eq(users.id, userId));
}

export async function userExists(userId: string): Promise<boolean> {
  const row = await getDb().query.users.findFirst({
    columns: { id: true },
    where: eq(users.id, userId),
  });
  return !!row;
}

export async function withdrawConsent(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ consentedAt: null, consentVersion: null })
    .where(eq(users.id, userId));
}

export async function deleteAllUserData(userId: string): Promise<void> {
  await getDb().delete(users).where(eq(users.id, userId));
}
