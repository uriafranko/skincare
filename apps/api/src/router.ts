import { createPendingUserForPhone, getUser, resolveUserId } from "@skintext/db";
import { detectRegion, generateId } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { handleMessage } from "@/handlers/message";
import { handleOnboarding } from "@/handlers/onboarding";

export async function routeMessage(
  log: RequestLogger,
  encryptedPhone: string,
  rawPhone: string,
  text: string,
  imageUrl?: string,
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

  log.set({ route: "message" });
  const reply = await handleMessage(log, user, text, imageUrl);
  return reply ? [reply] : [];
}
