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

const baseProfile = {
  id: "usr_test123",
  phone: "encrypted",
  name: "Alice",
  locale: "en",
  timezone: "America/New_York",
  country: "US",
  skinType: "combination" as const,
  sensitivity: "medium" as const,
  concerns: ["dryness", "redness"],
  goals: ["simple routine"],
  allergies: ["fragrance"],
  currentProducts: ["gentle cleanser"],
  routinePreference: "simple" as const,
  onboardingComplete: true,
  consentedAt: "2026-06-04T00:00:00Z",
  consentVersion: "2026-06-04",
  createdAt: "2026-06-04T00:00:00Z",
};

const baseContext = {
  userId: "usr_test123",
  userName: "Alice",
  localeName: "English",
  locale: "en",
  timezone: "America/New_York",
  localDate: "2026-06-04",
  userProfile: baseProfile,
  memories: null,
  streak: null,
  products: [],
};

function makeContext(overrides: Record<string, unknown> = {}) {
  return { ...baseContext, ...overrides };
}

describe("buildSkintextSystemPrompt", () => {
  test("includes Skintext identity and exact-language rule", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Skintext");
    expect(prompt).toContain("EXACT language");
    expect(prompt).toContain("For any language the user writes in, reply in that same language");
    expect(prompt).toContain("Hebrew -> Hebrew");
    expect(prompt).toContain("skincare routine assistant");
  });

  test("includes user-facing boundary guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Never mention tool names");
    expect(prompt).toContain("internal workflows");
    expect(prompt).toContain("Describe actions as Skintext doing them directly");
    expect(prompt).toContain(`Never mention ${USER_REMINDER_OPEN_TAG} tags`);
  });

  test("handles scheduled reminder events as internal agent inputs", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Scheduled reminder events");
    expect(prompt).toContain(USER_REMINDER_TAG_EXAMPLE);
    expect(prompt).toContain("internal scheduled reminder event");
    expect(prompt).toContain("Reply in the user's saved locale");
    expect(prompt).toContain("write the outbound text the user should receive");
  });

  test("wraps scheduled reminder input for synthetic agent turns", () => {
    expect(wrapUserReminder("Check whether irritation improved.")).toBe(
      `${USER_REMINDER_OPEN_TAG}\nCheck whether irritation improved.\n${USER_REMINDER_CLOSE_TAG}`,
    );
  });

  test("includes action policy guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Action policy");
    expect(prompt).toContain("If the user's intent is clear and low-risk, do it immediately");
    expect(prompt).toContain("ask for explicit confirmation first");
    expect(prompt).toContain("ask one brief clarifying question instead of guessing");
    expect(prompt).toContain("If an action fails, say what failed in first person");
  });

  test("includes mistake and frustration recovery guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Mistakes and frustration");
    expect(prompt).toContain("briefly acknowledge the issue from their perspective");
    expect(prompt).toContain("Do not explain technical causes");
  });

  test("includes natural memory use guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Natural memory use");
    expect(prompt).toContain("Use saved preferences and facts naturally");
    expect(prompt).toContain('Never say "I remember from memory"');
    expect(prompt).toContain("Got it, I'll keep that in mind");
  });

  test("includes grounded personalization guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Use the user's first name occasionally");
    expect(prompt).toContain("Compliment choices and care, not appearance");
    expect(prompt).toContain("Avoid romantic, intense, dependency-building, or generic flattery");
    expect(prompt).toContain("Make the user feel seen");
  });

  test("includes human texture guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Human texture");
    expect(prompt).toContain("Mirror the user's tone lightly");
    expect(prompt).toContain("tiny natural acknowledgments");
    expect(prompt).toContain("Gentle humor is OK around routine logistics");
    expect(prompt).toContain("Never joke about the user's appearance");
    expect(prompt).toContain("repeated logs do not sound robotic");
  });

  test("includes context priority guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Context priority");
    expect(prompt).toContain("latest user message, attached photo");
    expect(prompt).toContain("verified log data from getTodayRoutineLog wins");
  });

  test("includes skincare profile context", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Skin type: combination");
    expect(prompt).toContain("Sensitivity: medium");
    expect(prompt).toContain("fragrance");
  });

  test("includes image handling and safety boundaries", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("photo is already attached in the latest message context");
    expect(prompt).toContain("Use it directly");
    expect(prompt).toContain("request analysis");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("recommend professional care");
    expect(prompt).toContain("Write like a person texting");
    expect(prompt).toContain("Default to plain text");
    expect(prompt).toContain("Do not use labeled sections");
    expect(prompt).toContain("Do not introduce advice with templated phrases");
    expect(prompt).toContain("Prefer complete sentences over colon-led fragments");
    expect(prompt).toContain("Answer, log, or update first");
    expect(prompt).toContain("skip extra offers");
    expect(prompt).toContain("Do not include absent symptoms or absent injuries");
    expect(prompt).toContain("Do not add broad reassurance");
    expect(prompt).toContain("nothing looks abnormal");
    expect(prompt).toContain("Mention professional care only when urgent signs are visible");
    expect(prompt).toContain("End photo replies after the practical next step");
    expect(prompt).toContain("If you want, I can");
  });

  test("includes routine and product tools", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("logRoutineStep");
    expect(prompt).toContain("logProductUse");
    expect(prompt).toContain("listProducts");
  });

  test("does not include old-domain tracking language", () => {
    const prompt = buildSkintextSystemPrompt(makeContext()).toLowerCase();
    const oldTerms = ["calo" + "rie", "k" + "cal", "ma" + "cro"];
    for (const term of oldTerms) {
      expect(prompt).not.toContain(term);
    }
  });

  test("routes one-off reminders separately from recurring reminders", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Use scheduleOneOffReminder");
    expect(prompt).toContain("Use getReminders first");
    expect(prompt).toContain("use setReminders");
    expect(prompt).toContain("Today's date: 2026-06-04");
    expect(prompt).toContain("pass a relative delay");
    expect(prompt).toContain("use relative wording when natural");
    expect(prompt).not.toContain("Current timestamp:");
    expect(prompt).toContain("Do not use setReminders for one-off reminders");
  });

  test("treats recurring reminders as opt-in and adjustable", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Recurring reminders");
    expect(prompt).toContain("Recurring routine reminders are opt-in");
    expect(prompt).toContain("ask what local time");
    expect(prompt).toContain("Do not invent a time for a missing slot");
    expect(prompt).toContain("call getReminders first");
    expect(prompt).toContain("Preserve untouched reminder slots");
    expect(prompt).toContain("updateProfile for timezone first");
    expect(prompt).toContain("use getReminders");
  });
});

describe("scheduled prompts", () => {
  test("daily summary includes locale and routine status", () => {
    const prompt = buildDailyRoutineSummaryPrompt("sv");
    expect(prompt).toContain("Swedish");
    expect(prompt).toContain("morning and evening routines");
    expect(prompt).toContain("user's first name");
    expect(prompt).toContain("grounded encouragement");
    expect(prompt).toContain("Do not use labeled sections");
  });

  test("reminder prompt asks for done/skip or photo", () => {
    const prompt = buildRoutineReminderPrompt("en");
    expect(prompt).toContain("English");
    expect(prompt).toContain("done/skip");
    expect(prompt).toContain("product/skin photo");
    expect(prompt).toContain("user's first name");
    expect(prompt).toContain("tiny grounded encouragement");
  });

  test("weekly recap is adherence focused", () => {
    const prompt = buildWeeklyRoutineRecapPrompt("en");
    expect(prompt).toContain("morning/evening routine slots");
    expect(prompt).toContain("conversational");
    expect(prompt).toContain("user's first name");
    expect(prompt).toContain("grounded encouragement");
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
});
