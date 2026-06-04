import { describe, expect, mock, test } from "bun:test";

mock.module("@skintext/shared", () => ({
  env: {},
  encryptContent: async (s: string) => `enc:${s}`,
  decrypt: async (s: string) => s.replace(/^enc:/, ""),
  generateId: () => "reminder_test",
  getLocaleName: (locale: string) => {
    const names: Record<string, string> = { en: "English", sv: "Swedish" };
    return names[locale] ?? "English";
  },
  localDateString: () => "2026-06-04",
  localDateTimeToDate: (date: string, hour: number, minute: number, timezone: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    const [, year, month, day] = match;
    const offsetHours = timezone === "America/New_York" ? 4 : 0;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), hour + offsetHours, minute),
    );
  },
}));

const {
  buildDailyRoutineSummaryPrompt,
  buildRoutineReminderPrompt,
  buildSkintextSystemPrompt,
  buildWeeklyRoutineRecapPrompt,
} = await import("../prompts");

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
  todayLog: null,
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
    expect(prompt).toContain("skincare routine assistant");
  });

  test("includes user-facing boundary guidance", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("Never mention tool names");
    expect(prompt).toContain("internal workflows");
    expect(prompt).toContain("Describe actions as Skintext doing them directly");
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
    expect(prompt).toContain("analyzeSkincareImage");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("recommend professional care");
  });

  test("includes routine and product tools", () => {
    const prompt = buildSkintextSystemPrompt(makeContext());
    expect(prompt).toContain("logRoutineStep");
    expect(prompt).toContain("logProductUse");
    expect(prompt).toContain("listProducts");
  });

  test("includes today's routine context when present", () => {
    const prompt = buildSkintextSystemPrompt(
      makeContext({
        todayLog: {
          entries: [],
          entryCount: 2,
          completedSlots: ["morning"],
          productsUsed: ["Barrier Cream"],
          reactions: ["mild dryness"],
        },
      }),
    );
    expect(prompt).toContain("Today so far: 2 routine entries");
    expect(prompt).toContain("Barrier Cream");
    expect(prompt).toContain("mild dryness");
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
    expect(prompt).toContain("Use setReminders");
    expect(prompt).toContain("Today's date: 2026-06-04");
    expect(prompt).toContain("pass a relative delay");
    expect(prompt).not.toContain("Current timestamp:");
    expect(prompt).toContain("Do not use setReminders for one-off reminders");
  });
});

describe("scheduled prompts", () => {
  test("daily summary includes locale and routine status", () => {
    const prompt = buildDailyRoutineSummaryPrompt("sv");
    expect(prompt).toContain("Swedish");
    expect(prompt).toContain("AM:");
    expect(prompt).toContain("PM:");
  });

  test("reminder prompt asks for done/skip or photo", () => {
    const prompt = buildRoutineReminderPrompt("en");
    expect(prompt).toContain("English");
    expect(prompt).toContain("done/skip");
    expect(prompt).toContain("product/skin photo");
  });

  test("weekly recap is adherence focused", () => {
    const prompt = buildWeeklyRoutineRecapPrompt("en");
    expect(prompt).toContain("Done: [x]/14 AM/PM slots");
    expect(prompt).toContain("Reactions");
  });
});
