import type { RoutineSlot } from "./types";

export const ROUTINE_TIMES = [
  { label: "morning" as RoutineSlot, hour: 8, minute: 0, emoji: "☀️" },
  { label: "evening" as RoutineSlot, hour: 21, minute: 0, emoji: "🌙" },
] as const;

export const DAILY_SUMMARY_HOUR = 22;
export const WEEKLY_RECAP_HOUR = 20;
export const WEEKLY_RECAP_DAY = "Sunday";
export const CONSENT_VERSION = "2026-07-29";
export const PHOTO_RETENTION_CONSENT_VERSION = "2026-07-26";
export const PERSONALITY_POLICY_VERSION = "personality-v1";

export const ADHERENCE_MILESTONES: Record<number, string> = {
  3: "3 routine days in a row. Skin changes take time, so consistency matters.",
  7: "One full week of routine logs. Keep changes slow and track reactions.",
  14: "Two weeks of routine history. That is enough context to start spotting patterns.",
  30: "30 days of routine tracking. If irritation persists, consider checking with a clinician.",
};
