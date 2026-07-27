import { describe, expect, test } from "bun:test";
import { buildRoutineReminderEvent } from "../reminder-events";

describe("buildRoutineReminderEvent", () => {
  test("builds a clear routine reminder event without awkward articles", () => {
    const event = buildRoutineReminderEvent({
      routineLabel: "evening",
      routineEmoji: "🌙",
      userLocale: "en",
      completedSlots: ["morning"],
      entryCount: 1,
      productsUsed: ["Gentle Cleanser"],
      streakDays: 3,
    });

    expect(event).toContain("Generate a skincare routine reminder for the evening routine.");
    expect(event).not.toContain("a evening");
    expect(event).toContain("User locale: en");
    expect(event).toContain("Use working memory and retained history");
  });
});
