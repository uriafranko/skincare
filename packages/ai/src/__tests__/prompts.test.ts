import { describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () =>
  createSharedMock({
    getLocaleName: (locale: string) => {
      const names: Record<string, string> = { en: "English", he: "Hebrew", sv: "Swedish" };
      return names[locale] ?? "English";
    },
  }),
);

const {
  buildDailyRoutineSummaryPrompt,
  buildRoutineReminderPrompt,
  buildSkintextSystemPrompt,
  buildWeeklyRoutineRecapPrompt,
} = await import("../prompts");
const {
  USER_REMINDER_CLOSE_TAG,
  USER_REMINDER_OPEN_TAG,
  USER_REMINDER_TAG_EXAMPLE,
  wrapUserReminder,
} = await import("../user-reminder");

const baseAccount = {
  id: "usr_test123",
  phone: "encrypted",
  locale: "en",
  timezone: "America/New_York",
  timezoneConfirmed: true,
  country: "US",
  styleOfferState: "shown" as const,
  photoRetentionConsentedAt: null,
  photoRetentionConsentVersion: null,
  photoRetentionOfferShownAt: null,
  onboardingComplete: true,
  consentedAt: "2026-07-26T00:00:00Z",
  consentVersion: "2026-07-26",
  createdAt: "2026-07-26T00:00:00Z",
};

const baseContext = {
  userId: "usr_test123",
  localeName: "English",
  locale: "en",
  timezone: "America/New_York",
  localDate: "2026-07-26",
  userAccount: baseAccount,
  riskState: "routine" as const,
  shouldOfferStyle: false,
  shouldOfferPhotoRetention: false,
  hasImage: false,
  isScheduledEvent: false,
  streak: 4,
};

function makeContext(overrides: Record<string, unknown> = {}) {
  return { ...baseContext, ...overrides };
}

describe("buildSkintextSystemPrompt", () => {
  test("composes every trusted-core policy module", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("ROLE AND IDENTITY");
    expect(prompt).toContain("CONVERSATION POLICY");
    expect(prompt).toContain("SAFETY POLICY");
    expect(prompt).toContain("BODY-IMAGE POLICY");
    expect(prompt).toContain("COMMERCE POLICY");
    expect(prompt).toContain("MEMORY AND PRIVACY POLICY");
    expect(prompt).toContain("IMAGE POLICY");
    expect(prompt).toContain("ACTION AND TOOL POLICY");
    expect(prompt).toContain("SCHEDULED EVENTS");
  });

  test("keeps conversational user state in working memory instead of the system prompt", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("TURN CONTEXT");
    expect(prompt).toContain("Use working memory and newer retained history");
    expect(prompt).not.toContain("Name: Alice");
    expect(prompt).not.toContain("Skin type: combination");
    expect(prompt).not.toContain("Allergies/avoids: fragrance");
    expect(prompt).not.toContain("Gentle Cleanser");
    expect(prompt).toContain("Adherence streak: 4");
    expect(prompt).toContain("exact language of the latest user message");
  });

  test("keeps routine-log payloads out of the dynamic system prompt", () => {
    const prompt = buildSkintextSystemPrompt(
      makeContext({
        recentRoutineLogs: [
          {
            date: "2026-07-25",
            log: {
              entries: [
                {
                  id: "routine_1",
                  userId: "usr_test123",
                  slot: "evening",
                  steps: [
                    {
                      name: "moisturize",
                      category: "moisturizer",
                      productName: "Barrier Cream",
                    },
                  ],
                  completed: true,
                  reaction: "less tightness",
                  source: "text",
                  timestamp: "2026-07-25T20:00:00Z",
                  localDate: "2026-07-25",
                },
              ],
              entryCount: 1,
              completedSlots: ["evening"],
              productsUsed: ["Barrier Cream"],
              reactions: ["less tightness"],
            },
          },
        ],
      }),
    );

    expect(prompt).not.toContain("routine_1");
    expect(prompt).not.toContain("Barrier Cream");
    expect(prompt).not.toContain("less tightness");
    expect(prompt).not.toContain("RECENT VERIFIED ROUTINE HISTORY");
    expect(prompt).toContain("retained message history and observational memory");
    expect(prompt).toContain("verified routine-log actions");
  });

  test("includes safety, privacy, commercial, and action invariants", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Never confirm that the user is ugly");
    expect(prompt).toContain('"Buy nothing"');
    expect(prompt).toContain("latest explicit addition, correction, stop, removal, or forget");
    expect(prompt).toContain("Raw image bytes and private URLs");
    expect(prompt).toContain("Keep only one active skincare experiment");
  });

  test("does not inject experiment state outside working memory", () => {
    const prompt = buildSkintextSystemPrompt(
      makeContext({
        activeExperiment: {
          id: "experiment_1",
          userId: "usr_test123",
          change: "Use azelaic acid every other night",
          baseline: "Redness is unchanged",
          startedAt: "2026-07-20T00:00:00Z",
          plannedReviewAt: "2026-08-03T00:00:00Z",
          status: "active",
          createdAt: "2026-07-20T00:00:00Z",
        },
      }),
    );
    expect(prompt).not.toContain("Use azelaic acid every other night");
    expect(prompt).not.toContain("Redness is unchanged");
    expect(prompt).toContain("experiment state as conversational memory");
  });

  test("treats scheduled reminder tags as internal input", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain(USER_REMINDER_TAG_EXAMPLE);
    expect(prompt).toContain("internal scheduled events");
    expect(prompt).toContain("Reply in the user's saved locale");
    expect(prompt).toContain("Continue the same user's ongoing conversation");
    expect(prompt).toContain("working memory, retained history, observational memory");
    expect(prompt).toContain("load them with the verified routine-log actions");
    expect(prompt).toContain(`Never mention ${USER_REMINDER_OPEN_TAG}`);
    expect(wrapUserReminder("Check whether irritation improved.")).toBe(
      `${USER_REMINDER_OPEN_TAG}\nCheck whether irritation improved.\n${USER_REMINDER_CLOSE_TAG}`,
    );
  });

  test("does not inject saved image metadata into system context", () => {
    const prompt = buildSkintextSystemPrompt(
      makeContext({
        recentImages: [
          {
            id: "img_123",
            sourceText: "is this irritation improving?",
            createdAt: "2026-07-26T12:00:00Z",
          },
        ],
      }),
    );
    expect(prompt).not.toContain("img_123");
    expect(prompt).not.toContain("is this irritation improving?");
  });
});

describe("scheduled prompts", () => {
  test("daily summary includes locale and routine status", () => {
    const prompt = buildDailyRoutineSummaryPrompt("sv");
    expect(prompt).toContain("Swedish");
    expect(prompt).toContain("morning and evening routines");
    expect(prompt).toContain("grounded encouragement");
  });

  test("reminder prompt asks for done/skip or photo", () => {
    const prompt = buildRoutineReminderPrompt("en");
    expect(prompt).toContain("English");
    expect(prompt).toContain("done/skip");
    expect(prompt).toContain("product/skin photo");
  });

  test("weekly recap is adherence focused", () => {
    const prompt = buildWeeklyRoutineRecapPrompt("en");
    expect(prompt).toContain("morning/evening routine slots");
    expect(prompt).toContain("conversational");
  });

  test("scheduled prompts support Hebrew locale names", () => {
    expect(buildDailyRoutineSummaryPrompt("he")).toContain("Hebrew");
    expect(buildRoutineReminderPrompt("he")).toContain("Hebrew");
    expect(buildWeeklyRoutineRecapPrompt("he")).toContain("Hebrew");
  });
});

describe("onboarding prompt source", () => {
  test("completion guidance localizes done replies", async () => {
    const source = await Bun.file(new URL("../onboarding.ts", import.meta.url)).text();
    expect(source).toContain('localized equivalent of "done"');
    expect(source).toContain('Do not use the English word "done" unless replying in English');
  });

  test("setup guidance localizes consent and CTA copy", async () => {
    const source = await Bun.file(new URL("../onboarding.ts", import.meta.url)).text();
    expect(source).toContain("Ask whether it is OK to save setup details");
    expect(source).toContain("End with a localized low-friction CTA");
  });

  test("onboarding matches the user's language, code-switching, and conversational voice", async () => {
    const source = await Bun.file(new URL("../onboarding.ts", import.meta.url)).text();
    expect(source).toContain("latest message as the voice reference");
    expect(source).toContain("natural language mix if they code-switch");
    expect(source).toContain("slang level");
    expect(source).toContain("Do not force slang, caricature a dialect");
  });
});
