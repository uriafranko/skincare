import { beforeEach, describe, expect, mock, test } from "bun:test";

let nextOutput: Record<string, unknown>;

const generateTextMock = mock(async () => ({ output: nextOutput }));

mock.module("ai", () => ({
  gateway: () => ({ provider: "test", modelId: "test" }),
  generateText: generateTextMock,
  Output: {
    object: (value: unknown) => value,
  },
}));

const { processOnboardingMessage } = await import("../onboarding");

function output(overrides: Record<string, unknown> = {}) {
  return {
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
    consented: null,
    detectedLocale: null,
    reply: "placeholder",
    ...overrides,
  };
}

const setupCompleteExceptConsent = {
  name: "Dana",
  skinType: "combination",
  concerns: ["redness"],
} as const;

describe("processOnboardingMessage", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
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
      { modelId: "test" } as never,
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
      { modelId: "test" } as never,
    );

    expect(result.reply).toBe(hebrewConsent);
    expect(result.reply).not.toContain("OK if I save");
  });
});
