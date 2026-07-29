import { describe, expect, mock, test } from "bun:test";

mock.module("@skintext/shared", () => ({
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
  env: { SENDBLUE_WEBHOOK_SECRET: "expected-secret" },
  generateId: () => "test_id",
  getLocaleName: (locale: string) => {
    const names: Record<string, string> = { en: "English", sv: "Swedish" };
    return names[locale] ?? "English";
  },
  getTimezoneCity: (timezone: string) => timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone,
  isDayOfWeek: () => true,
  isValidTimeZone: () => true,
  isOnboardingComplete: () => true,
  localDateString: () => "2026-06-04",
  localDateTimeToDate: () => new Date("2026-06-04T12:00:00.000Z"),
  localHour: () => 12,
  markRead: async () => {},
  msUntil: () => 0,
  nextLocalTime: () => new Date("2026-06-05T12:00:00.000Z"),
  sendImageFile: async () => {},
  sendImageMessage: async () => {},
  sendMessage: async () => {},
  sendTyping: async () => {},
  uploadMediaFile: async () => "https://cdn.sendblue.test/image.jpg",
}));

const { parseInbound } = await import("../sendblue");

const inboundBody = {
  status: "RECEIVED",
  is_outbound: false,
  number: "+15555550123",
  content: "hello",
  media_url: "",
  message_handle: "message-1",
};

describe("parseInbound", () => {
  test("rejects webhook requests without a signing secret", () => {
    expect(parseInbound(new Headers(), inboundBody)).toBeNull();
  });

  test("rejects webhook requests with an invalid signing secret", () => {
    const headers = new Headers({ "sb-signing-secret": "wrong-secret" });

    expect(parseInbound(headers, inboundBody)).toBeNull();
  });

  test("accepts Sendblue's documented signing secret header", () => {
    const headers = new Headers({ "sb-signing-secret": "expected-secret" });

    expect(parseInbound(headers, inboundBody)).toEqual({
      phone: "+15555550123",
      text: "hello",
      imageUrl: undefined,
      messageId: "message-1",
    });
  });
});
