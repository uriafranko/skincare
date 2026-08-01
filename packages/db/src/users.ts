import type { StyleOfferState, UserAccount } from "@skintext/shared";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema";

export async function resolveUserId(phone: string): Promise<string | null> {
  const row = await getDb().query.users.findFirst({
    columns: { id: true },
    where: eq(users.phone, phone),
  });
  return row?.id ?? null;
}

function pendingUserValues(
  userId: string,
  phone: string,
  account: Pick<UserAccount, "locale" | "timezone" | "country">,
): typeof users.$inferInsert {
  return {
    id: userId,
    phone,
    locale: account.locale,
    timezone: account.timezone,
    timezoneConfirmed: false,
    country: account.country,
    styleOfferState: "pending",
    photoRetentionConsentedAt: null,
    photoRetentionConsentVersion: null,
    photoRetentionOfferShownAt: null,
    onboardingComplete: false,
    consentedAt: null,
    consentVersion: null,
    createdAt: new Date().toISOString(),
  };
}

export async function createPendingUserForPhone(
  userId: string,
  phone: string,
  account: Pick<UserAccount, "locale" | "timezone" | "country">,
): Promise<string> {
  const db = getDb();
  const [inserted] = await db
    .insert(users)
    .values(pendingUserValues(userId, phone, account))
    .onConflictDoNothing()
    .returning({ id: users.id });

  const resolvedUserId =
    inserted?.id ??
    (
      await db.query.users.findFirst({
        columns: { id: true },
        where: eq(users.phone, phone),
      })
    )?.id;

  if (!resolvedUserId) {
    throw new Error("Unable to create or resolve pending user for phone.");
  }

  return resolvedUserId;
}

export async function getUser(userId: string): Promise<UserAccount | null> {
  const d = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!d) return null;
  return {
    id: userId,
    phone: String(d.phone ?? ""),
    locale: String(d.locale ?? "en"),
    timezone: String(d.timezone ?? "UTC"),
    timezoneConfirmed: d.timezoneConfirmed === true,
    country: String(d.country ?? "US"),
    styleOfferState: String(d.styleOfferState ?? "pending") as StyleOfferState,
    photoRetentionConsentedAt: d.photoRetentionConsentedAt
      ? String(d.photoRetentionConsentedAt)
      : null,
    photoRetentionConsentVersion: d.photoRetentionConsentVersion
      ? String(d.photoRetentionConsentVersion)
      : null,
    photoRetentionOfferShownAt: d.photoRetentionOfferShownAt
      ? String(d.photoRetentionOfferShownAt)
      : null,
    onboardingComplete: String(d.onboardingComplete) === "true",
    consentedAt: d.consentedAt ? String(d.consentedAt) : null,
    consentVersion: d.consentVersion ? String(d.consentVersion) : null,
    createdAt: String(d.createdAt ?? new Date().toISOString()),
  };
}

export async function createUser(
  userId: string,
  phone: string,
  account: Omit<UserAccount, "id" | "phone" | "createdAt">,
): Promise<void> {
  const createdAt = new Date().toISOString();
  await getDb()
    .insert(users)
    .values({
      id: userId,
      phone,
      locale: account.locale,
      timezone: account.timezone,
      timezoneConfirmed: account.timezoneConfirmed,
      country: account.country,
      styleOfferState: account.styleOfferState,
      photoRetentionConsentedAt: account.photoRetentionConsentedAt,
      photoRetentionConsentVersion: account.photoRetentionConsentVersion,
      photoRetentionOfferShownAt: account.photoRetentionOfferShownAt,
      onboardingComplete: account.onboardingComplete,
      consentedAt: account.consentedAt,
      consentVersion: account.consentVersion,
      createdAt,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        phone,
        locale: account.locale,
        timezone: account.timezone,
        timezoneConfirmed: account.timezoneConfirmed,
        country: account.country,
        styleOfferState: account.styleOfferState,
        photoRetentionConsentedAt: account.photoRetentionConsentedAt,
        photoRetentionConsentVersion: account.photoRetentionConsentVersion,
        photoRetentionOfferShownAt: account.photoRetentionOfferShownAt,
        onboardingComplete: account.onboardingComplete,
        consentedAt: account.consentedAt,
        consentVersion: account.consentVersion,
      },
    });
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
      case "locale":
        updates.locale = value;
        break;
      case "timezone":
        updates.timezone = value;
        break;
      case "timezoneConfirmed":
        updates.timezoneConfirmed = value === "true";
        break;
      case "country":
        updates.country = value;
        break;
      case "styleOfferState":
        updates.styleOfferState = value;
        break;
      case "photoRetentionConsentedAt":
        updates.photoRetentionConsentedAt = value || null;
        break;
      case "photoRetentionConsentVersion":
        updates.photoRetentionConsentVersion = value || null;
        break;
      case "photoRetentionOfferShownAt":
        updates.photoRetentionOfferShownAt = value || null;
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
