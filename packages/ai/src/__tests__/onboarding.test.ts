import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { OnboardingExtraction } from "../onboarding";
import { createSharedMock } from "./shared-mock";

let nextOutput: OnboardingExtraction;

const generateMock = mock(async () => nextOutput);

mock.module("@skintext/shared", () => createSharedMock());

const {
  buildOnboardingStateProjection,
  onboardingExtractionSchema,
  onboardingThreadId,
  processOnboardingMessage,
} = await import("../onboarding");

function output(overrides: Partial<OnboardingExtraction> = {}): OnboardingExtraction {
  return onboardingExtractionSchema.parse({
    ageEligible: null,
    name: null,
    skinType: null,
    sensitivity: null,
    concerns: null,
    goals: null,
    allergies: null,
    currentProducts: null,
    routinePreference: null,
    morningReminder: null,
    eveningReminder: null,
    timezone: null,
    consented: null,
    detectedLocale: null,
    reply: "placeholder",
    ...overrides,
  });
}

const setupCompleteExceptConsent = {
  ageEligible: true,
  name: "Dana",
  skinType: "combination" as const,
  concerns: ["redness"],
};

describe("processOnboardingMessage", () => {
  beforeEach(() => {
    generateMock.mockClear();
    nextOutput = output();
  });

  test("keeps exact English consent-only copy for English users", async () => {
    nextOutput = output({
      detectedLocale: "en",
      reply: "Can I save this?",
    });

    const result = await processOnboardingMessage(
      "remind me at 8",
      setupCompleteExceptConsent,
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
      generateMock,
    );

    expect(result.reply).toBe(
      "One last thing: reply AGREE if I can save your skincare data for reminders and logs and you accept the Terms of Use: https://skintext.ai/terms. Privacy Policy: https://skintext.ai/privacy. You can delete your data anytime.",
    );
    expect(result.nextAction).toBe("ask_consent");
  });

  test("preserves a warmer English consent request when every legal element is present", async () => {
    const warmConsent =
      "Got it - simple and fragrance-free. One last thing: reply AGREE if I can save your skincare data for reminders and logs and you accept the Terms of Use: https://skintext.ai/terms. Privacy Policy: https://skintext.ai/privacy. You can delete your data anytime.";
    nextOutput = output({
      detectedLocale: "en",
      reply: warmConsent,
    });

    const result = await processOnboardingMessage(
      "Keep it simple and fragrance-free",
      setupCompleteExceptConsent,
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
      generateMock,
    );

    expect(result.reply).toBe(warmConsent);
    expect(result.nextAction).toBe("ask_consent");
  });

  test("uses the main conversation thread and projects only authoritative setup state", () => {
    const projection = buildOnboardingStateProjection(
      {
        ageEligible: true,
        name: "Dana",
        concerns: ["redness"],
        skinType: "combination",
        timezone: "America/New_York",
        timezoneConfirmed: false,
        lastBotReply: "stale prompt text",
      },
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
    );

    expect(onboardingThreadId("usr_123")).toBe("skintext:usr_123");
    expect(projection.currentAction).toBe("ask_consent");
    expect(projection.collected?.confirmedTimezone).toBeNull();
    expect(JSON.stringify(projection)).not.toContain("stale prompt text");

    const retired = buildOnboardingStateProjection(
      { ...setupCompleteExceptConsent, consented: true },
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
    );
    expect(retired).toEqual({
      version: 1,
      mode: "onboarding",
      active: false,
      currentAction: "complete",
      missingFields: [],
    });
  });

  test("does not force English consent-only copy for Hebrew users", async () => {
    const hebrewConsent = "אפשר לשמור את זה כדי שתזכורות ויומנים יעבדו? אפשר למחוק בכל זמן.";
    nextOutput = output({
      detectedLocale: "he",
      reply: hebrewConsent,
    });

    const result = await processOnboardingMessage(
      "תזכיר לי ב-8",
      { ...setupCompleteExceptConsent, name: "דנה" },
      {
        isFirstMessage: false,
        locale: "he",
        timezone: "Asia/Jerusalem",
      },
      generateMock,
    );

    expect(result.reply).toBe(hebrewConsent);
    expect(result.reply).not.toContain("OK if I save");
  });

  test("marks only an explicitly stated valid timezone as confirmed", async () => {
    nextOutput = output({
      morningReminder: "08:00",
      timezone: "America/Chicago",
      reply: "Got it.",
    });

    const result = await processOnboardingMessage(
      "I'm in Chicago, remind me at 8am",
      setupCompleteExceptConsent,
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
      generateMock,
    );

    expect(result.extracted).toEqual(
      expect.objectContaining({
        morningReminder: "08:00",
        timezone: "America/Chicago",
        timezoneConfirmed: true,
      }),
    );
  });

  test("asks only for 16+ confirmation on the first greeting", async () => {
    const result = await processOnboardingMessage(
      "hey",
      {},
      {
        isFirstMessage: true,
        locale: "en",
        timezone: "UTC",
      },
      generateMock,
    );

    expect(result.reply).toBe("Hey, I'm Lily. Before we get started, are you 16 or older?");
    expect(generateMock).not.toHaveBeenCalled();
  });

  test("extracts 16+ eligibility and allows consent-only completion", async () => {
    nextOutput = output({
      ageEligible: true,
      detectedLocale: "en",
      reply: "Can I save this?",
    });

    const result = await processOnboardingMessage(
      "I'm 24",
      setupCompleteExceptConsent,
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "UTC",
      },
      generateMock,
    );

    expect(result.extracted.ageEligible).toBe(true);
    expect(result.reply).toBe(
      "One last thing: reply AGREE if I can save your skincare data for reminders and logs and you accept the Terms of Use: https://skintext.ai/terms. Privacy Policy: https://skintext.ai/privacy. You can delete your data anytime.",
    );
  });

  test("keeps a warm model-written starting point when setup completes", async () => {
    nextOutput = output({
      consented: true,
      detectedLocale: "en",
      reply:
        "You're set, Dana. Tonight, keep it easy with your cleanser and moisturizer, then tell me how your skin felt.",
    });

    const result = await processOnboardingMessage(
      "AGREE",
      setupCompleteExceptConsent,
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "America/New_York",
      },
      generateMock,
    );

    expect(result.nextAction).toBe("complete");
    expect(result.reply).toBe(
      "You're set, Dana. Tonight, keep it easy with your cleanser and moisturizer, then tell me how your skin felt.",
    );
    expect(result.reply).not.toContain("Text done");
  });

  test("forwards an eligible onboarding photo for transient stateless guidance", async () => {
    nextOutput = output({
      detectedLocale: "en",
      reply: "That looks like a leave-on serum. What is the main thing you want it to help with?",
    });

    await processOnboardingMessage(
      "Where would this go?",
      { ageEligible: true },
      {
        isFirstMessage: false,
        locale: "en",
        timezone: "UTC",
        imageUrl: "data:image/jpeg;base64,aGVsbG8=",
      },
      generateMock,
    );

    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: "data:image/jpeg;base64,aGVsbG8=",
      }),
    );
  });

  test("returns a firm eligibility boundary for an explicitly under-16 user", async () => {
    nextOutput = output({
      ageEligible: false,
      detectedLocale: "en",
      reply: "I can't continue.",
    });

    const result = await processOnboardingMessage(
      "I'm 15",
      {},
      {
        isFirstMessage: true,
        locale: "en",
        timezone: "UTC",
      },
      generateMock,
    );

    expect(result.extracted.ageEligible).toBe(false);
    expect(result.reply).toBe(
      "I can only help people who are 16 or older, so I can't continue setup.",
    );
  });
});
