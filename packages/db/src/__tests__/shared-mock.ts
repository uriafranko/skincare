export function createSharedMock(overrides: Record<string, unknown> = {}) {
  return {
    ADHERENCE_MILESTONES: {},
    CONSENT_VERSION: "2026-07-29",
    DAILY_SUMMARY_HOUR: 22,
    PERSONALITY_POLICY_VERSION: "personality-v1",
    PHOTO_RETENTION_CONSENT_VERSION: "2026-07-26",
    ROUTINE_TIMES: [
      { label: "morning", hour: 8, minute: 0, emoji: "sun" },
      { label: "evening", hour: 21, minute: 0, emoji: "moon" },
    ],
    WEEKLY_RECAP_DAY: "Sunday",
    WEEKLY_RECAP_HOUR: 20,
    decrypt: async (s: string) => s.replace(/^enc:/, ""),
    detectRegion: () => ({
      locale: "en",
      timezone: "UTC",
      country: "US",
      countryName: "United States",
    }),
    encrypt: async (s: string) => `enc:${s}`,
    encryptContent: async (s: string) => `enc:${s}`,
    env: {},
    generateId: () => "test_id",
    getLocaleName: (locale: string) => {
      const names: Record<string, string> = { en: "English", he: "Hebrew", sv: "Swedish" };
      return names[locale] ?? "English";
    },
    getTimezoneCity: (timezone: string) =>
      timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone,
    isDayOfWeek: () => true,
    isValidTimeZone: (timezone: string) => timezone === "UTC" || timezone.includes("/"),
    isOnboardingComplete: () => true,
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
    localHour: () => 12,
    markRead: async () => {},
    sendImageFile: async () => {},
    sendImageMessage: async () => {},
    msUntil: () => 0,
    nextLocalTime: () => new Date("2026-06-05T12:00:00.000Z"),
    sendMessage: async () => {},
    sendTyping: async () => {},
    uploadMediaFile: async () => "https://cdn.sendblue.test/image.jpg",
    ...overrides,
  };
}
