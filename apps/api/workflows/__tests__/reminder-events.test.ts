import { describe, expect, test } from "bun:test";
import { buildRoutineReminderEvent } from "../reminder-events";

describe("buildRoutineReminderEvent", () => {
  test("builds a clear routine reminder event without awkward articles", () => {
    const event = buildRoutineReminderEvent({
      routineLabel: "evening",
      routineEmoji: "🌙",
      userLocale: "en",
      userName: "Noor",
      completedSlots: ["morning"],
      entryCount: 1,
      productsUsed: ["Gentle Cleanser"],
      streakDays: 3,
      productNames: ["Gentle Cleanser", "Daily SPF"],
    });

    expect(event).toContain("Generate a skincare routine reminder for the evening routine.");
    expect(event).not.toContain("a evening");
    expect(event).toContain("User locale: en");
    expect(event).toContain("Saved products: Gentle Cleanser, Daily SPF");
  });
});
