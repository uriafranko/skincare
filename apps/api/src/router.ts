import { createPendingUserForPhone, getUser, resolveUserId, updateUser } from "@skintext/db";
import { CONSENT_VERSION, detectRegion, generateId, type UserAccount } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { handleMessage } from "@/handlers/message";
import { handleOnboarding } from "@/handlers/onboarding";
import { normalizeInboundImage } from "@/image";
import { errorForLogging } from "@/logging";
import { isExplicitTermsAcceptance, termsAcceptedReply, updatedTermsPrompt } from "@/terms-consent";
import { pruneExpiredUserImageBlobs } from "@/user-images";

async function requireCurrentTerms(user: UserAccount, text: string): Promise<string[] | null> {
  if (user.consentVersion === CONSENT_VERSION) return null;
  if (!isExplicitTermsAcceptance(text)) return [updatedTermsPrompt(user.locale)];

  const consentedAt = new Date().toISOString();
  await updateUser(user.id, {
    consentedAt,
    consentVersion: CONSENT_VERSION,
  });
  user.consentedAt = consentedAt;
  user.consentVersion = CONSENT_VERSION;
  return [termsAcceptedReply(user.locale)];
}

/**
 * Routes a plain-text message around the per-phone lock when an existing user
 * already has an active Mastra thread. Onboarding and images keep the lock
 * because they carry turn-local persistence and media callbacks.
 */
export async function routeConcurrentMessage(
  log: RequestLogger,
  encryptedPhone: string,
  rawPhone: string,
  text: string,
  rawImageUrl?: string,
  messageId?: string,
): Promise<string[] | undefined> {
  if (rawImageUrl) return;

  const userId = await resolveUserId(encryptedPhone);
  if (!userId) return;

  const user = await getUser(userId);
  if (!user?.onboardingComplete || !user.consentedAt || user.consentVersion !== CONSENT_VERSION) {
    return;
  }

  log.set({ userId, route: "message", concurrent: true });
  const reply = await handleMessage(log, user, rawPhone, text, undefined, undefined, messageId);
  return reply ? [reply] : [];
}

export async function routeMessage(
  log: RequestLogger,
  encryptedPhone: string,
  rawPhone: string,
  text: string,
  rawImageUrl?: string,
  messageId?: string,
): Promise<string[]> {
  let userId = await resolveUserId(encryptedPhone);
  let region = null;

  if (!userId) {
    region = detectRegion(rawPhone);
    userId = await createPendingUserForPhone(generateId(), encryptedPhone, {
      locale: region.locale,
      timezone: region.timezone,
      country: region.country,
    });
    log.set({ newUser: true });
  }

  log.set({ userId });

  const user = await getUser(userId);

  if (!user?.onboardingComplete) {
    log.set({ route: "onboarding" });
    return handleOnboarding(
      log,
      userId,
      text,
      encryptedPhone,
      region?.locale ?? user?.locale ?? "en",
      region?.timezone ?? user?.timezone ?? "UTC",
      region?.country ?? user?.country ?? "US",
    );
  }

  if (!user.consentedAt) {
    log.set({ route: "consent_withdrawn" });
    return [
      "Your data processing consent has been withdrawn. Message me again if you'd like to start over!",
    ];
  }

  const termsReply = await requireCurrentTerms(user, text);
  if (termsReply) {
    log.set({ route: "terms_consent", consentVersion: CONSENT_VERSION });
    return termsReply;
  }

  let imageUrl: string | undefined;
  const normalizedImage = rawImageUrl ? await normalizeInboundImage(rawImageUrl, log) : null;
  if (rawImageUrl) {
    imageUrl = normalizedImage?.dataUrl ?? rawImageUrl;
  }

  if (normalizedImage) {
    await pruneExpiredUserImageBlobs(log).catch((error) => {
      log.error(errorForLogging(error));
      log.set({ imagePruneError: true });
    });
  }

  log.set({ route: "message" });
  const reply = await handleMessage(
    log,
    user,
    rawPhone,
    text,
    imageUrl,
    normalizedImage ?? undefined,
    messageId,
  );
  return reply ? [reply] : [];
}
