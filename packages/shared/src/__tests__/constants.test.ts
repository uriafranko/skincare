import { describe, expect, test } from "bun:test";
import {
  ADHERENCE_MILESTONES,
  CONSENT_VERSION,
  DAILY_SUMMARY_HOUR,
  PHOTO_RETENTION_CONSENT_VERSION,
  ROUTINE_TIMES,
} from "../constants";

describe("routine constants", () => {
  test("defines morning and evening routine defaults", () => {
    expect(ROUTINE_TIMES).toEqual([
      { label: "morning", hour: 8, minute: 0, emoji: "☀️" },
      { label: "evening", hour: 21, minute: 0, emoji: "🌙" },
    ]);
  });

  test("daily summary runs after the evening routine", () => {
    expect(DAILY_SUMMARY_HOUR).toBeGreaterThan(ROUTINE_TIMES[1]!.hour);
  });

  test("has current consent version and adherence milestones", () => {
    expect(CONSENT_VERSION).toBe("2026-07-26");
    expect(PHOTO_RETENTION_CONSENT_VERSION).toBe("2026-07-26");
    expect(ADHERENCE_MILESTONES[7]).toContain("week");
  });
});
