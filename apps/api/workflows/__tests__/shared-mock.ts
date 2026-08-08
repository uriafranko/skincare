export function createSharedMock(overrides: Record<string, unknown> = {}) {
  const defaultGatewayModel = "openai/test-default";

  const getMissingFields = (state: Record<string, unknown>) => {
    const missing: string[] = [];
    if (state.ageEligible !== true) missing.push("age_eligibility");
    if (!state.name) missing.push("name");
    if (
      !(state.concerns as unknown[] | undefined)?.length &&
      !(state.goals as unknown[] | undefined)?.length
    ) {
      missing.push("skin_goals");
    }
    if (!state.skinType && !state.sensitivity) missing.push("skin_profile");
    if ((state.morningReminder || state.eveningReminder) && !state.timezoneConfirmed) {
      missing.push("timezone");
    }
    if (missing.length === 0 && !state.consented) missing.push("consent");
    return missing;
  };

  const sanitizeOnboardingExtraction = (
    state: Record<string, unknown>,
    extracted: Record<string, unknown>,
  ) => {
    if (state.ageEligible === true || extracted.ageEligible === true) return extracted;
    return {
      ...(extracted.ageEligible === false ? { ageEligible: false } : {}),
      ...(extracted.detectedLocale ? { detectedLocale: extracted.detectedLocale } : {}),
    };
  };

  return {
    ADHERENCE_MILESTONES: {},
    CONSENT_VERSION: "2026-07-29",
    DAILY_SUMMARY_HOUR: 22,
    DEFAULT_AI_GATEWAY_MODEL: defaultGatewayModel,
    DEFAULT_AI_GATEWAY_REASONING_EFFORT: "max",
    PERSONALITY_POLICY_VERSION: "personality-v1",
    PHOTO_RETENTION_CONSENT_VERSION: "2026-07-26",
    ROUTINE_TIMES: [
      { label: "morning", hour: 8, minute: 0, emoji: "sun" },
      { label: "evening", hour: 21, minute: 0, emoji: "moon" },
    ],
    WEEKLY_RECAP_DAY: "Sunday",
    WEEKLY_RECAP_HOUR: 20,
    detectRegion: () => ({
      locale: "en",
      timezone: "UTC",
      country: "US",
      countryName: "United States",
    }),
    env: {},
    generateId: () => "test_id",
    normalizePostgresConnectionString: (connectionString: string) => connectionString,
    getMissingFields,
    getOnboardingNextAction: (state: Record<string, unknown>) => {
      if (state.ageEligible === false) return "stop_underage";
      const firstMissing = getMissingFields(state)[0];
      if (!firstMissing) return "complete";
      if (firstMissing === "age_eligibility") return "ask_age";
      if (firstMissing === "timezone") return "ask_timezone";
      if (firstMissing === "consent") return "ask_consent";
      return "collect_profile";
    },
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
    mergeOnboardingState: (state: Record<string, unknown>, extracted: Record<string, unknown>) => ({
      ...state,
      ...extracted,
    }),
    msUntil: () => 0,
    nextLocalTime: () => new Date("2026-06-05T12:00:00.000Z"),
    resolveDefaultModelName: (source: { AI_GATEWAY_DEFAULT_MODEL?: string }) =>
      source.AI_GATEWAY_DEFAULT_MODEL?.trim() || defaultGatewayModel,
    resolveReasoningEffort: (source: { AI_GATEWAY_REASONING_EFFORT?: string }) =>
      source.AI_GATEWAY_REASONING_EFFORT?.trim() || "max",
    resolveMemoryModelName: (source: {
      AI_GATEWAY_DEFAULT_MODEL?: string;
      AI_GATEWAY_MEMORY_MODEL?: string;
    }) =>
      source.AI_GATEWAY_MEMORY_MODEL?.trim() ||
      source.AI_GATEWAY_DEFAULT_MODEL?.trim() ||
      defaultGatewayModel,
    sanitizeOnboardingExtraction,
    sendImageFile: async () => {},
    sendImageMessage: async () => {},
    sendMessage: async () => {},
    sendTyping: async () => {},
    uploadMediaFile: async () => "https://cdn.sendblue.test/image.jpg",
    ...overrides,
  };
}
