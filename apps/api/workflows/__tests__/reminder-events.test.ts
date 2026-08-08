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
    });

    expect(event).toContain("one short, natural iMessage");
    expect(event).not.toContain("a evening");
    expect(event).toContain("User locale: en");
    expect(event).toContain("Use working memory and retained history");
    expect(event).toContain("not like an automated notification");
    expect(event).toContain("Do not give a menu or ask for a command word");
    expect(event).not.toContain("Adherence streak");
  });
});
