import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

let nextOutput: Record<string, unknown>;

const generateMock = mock(async () => nextOutput);

mock.module("@skintext/shared", () => createSharedMock());

const { processOnboardingMessage } = await import("../onboarding");

function output(overrides: Record<string, unknown> = {}) {
  return {
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
  };
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
      generateMock as never,
    );

    expect(result.reply).toBe(
      "OK if I save this so reminders/logs work? You can delete it anytime.",
    );
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
      generateMock as never,
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
      generateMock as never,
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
      generateMock as never,
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
      generateMock as never,
    );

    expect(result.extracted.ageEligible).toBe(true);
    expect(result.reply).toBe(
      "OK if I save this so reminders/logs work? You can delete it anytime.",
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
      generateMock as never,
    );

    expect(result.extracted.ageEligible).toBe(false);
    expect(result.reply).toBe(
      "I can only help people who are 16 or older, so I can't continue setup.",
    );
  });
});
