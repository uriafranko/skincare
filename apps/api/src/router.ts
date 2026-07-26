import { createPendingUserForPhone, getUser, resolveUserId } from "@skintext/db";
import { detectRegion, generateId } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { handleMessage } from "@/handlers/message";
import { handleOnboarding } from "@/handlers/onboarding";
import { normalizeInboundImage } from "@/image";
import { pruneExpiredUserImageBlobs } from "@/user-images";

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

  let imageUrl: string | undefined;
  const normalizedImage = rawImageUrl ? await normalizeInboundImage(rawImageUrl, log) : null;
  if (rawImageUrl) {
    imageUrl = normalizedImage?.dataUrl ?? rawImageUrl;
  }

  if (normalizedImage) {
    await pruneExpiredUserImageBlobs(log).catch((error) => {
      log.error(error as Error);
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
