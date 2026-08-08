import { describe, expect, mock, test } from "bun:test";
import { createSharedMock } from "../../workflows/__tests__/shared-mock";

let storedState: Record<string, unknown> | null = null;
let failWorkingMemory = false;
let failReminders = false;
const createUser = mock(async () => {});
const completeUserOnboarding = mock(async () => {});
const deleteOnboardingState = mock(async () => {
  storedState = null;
});
const setCustomReminderTimes = mock(async () => {
  if (failReminders) throw new Error("reminder persistence unavailable");
});
const initializeUserWorkingMemory = mock(async () => {
  if (failWorkingMemory) throw new Error("working memory unavailable");
});

mock.module("@skintext/shared", () =>
  createSharedMock({
    isOnboardingComplete: (state: Record<string, unknown>) => state.consented === true,
    mergeOnboardingState: (state: Record<string, unknown>, extracted: Record<string, unknown>) => ({
      ...state,
      ...extracted,
    }),
  }),
);

mock.module("@skintext/db", () => ({
  completeUserOnboarding,
  createUser,
  deleteAllUserData: async () => {},
  deleteOnboardingState,
  getOnboardingState: async () => storedState,
  setCustomReminderTimes,
  setOnboardingState: async (_userId: string, diff: Record<string, unknown>) => {
    storedState = { ...(storedState ?? {}), ...diff };
  },
}));

let extracted: Record<string, unknown> = {};
const processOnboardingMessage = mock(async () => ({
  extracted,
  nextAction: extracted.consented ? "complete" : "collect_profile",
  reply: "reply",
}));
mock.module("@skintext/ai", () => ({
  buildOnboardingWorkingMemory: (input: unknown) => input,
  initializeUserWorkingMemory,
  processOnboardingMessage,
}));

mock.module("../posthog", () => ({ capturePostHogException: () => {}, posthog: null }));
mock.module("../reminder-runs", () => ({ reminderRunManager: { start: async () => {} } }));

const { handleOnboarding } = await import("../handlers/onboarding");

const log = {
  error: () => {},
  set: () => {},
} as never;

describe("onboarding persistence", () => {
  test("keeps onboarding retryable until initialization succeeds", async () => {
    storedState = null;
    extracted = {
      ageEligible: true,
      name: "Ari",
      concerns: ["dryness"],
      skinType: "dry",
      consented: true,
      detectedLocale: "en",
      morningReminder: "08:00",
      timezoneConfirmed: true,
    };
    failWorkingMemory = true;

    await expect(
      handleOnboarding(log, "usr_retry", "details", "+15555550123", "en", "UTC", "US"),
    ).rejects.toThrow("working memory unavailable");
    expect(completeUserOnboarding).not.toHaveBeenCalled();
    expect((storedState as Record<string, unknown> | null)?.consented).toBe(true);

    failWorkingMemory = false;
    failReminders = true;
    await expect(
      handleOnboarding(log, "usr_retry", "details", "+15555550123", "en", "UTC", "US"),
    ).rejects.toThrow("reminder persistence unavailable");
    expect(completeUserOnboarding).not.toHaveBeenCalled();
    expect(storedState).not.toBeNull();

    failReminders = false;
    await expect(
      handleOnboarding(log, "usr_retry", "details", "+15555550123", "en", "UTC", "US"),
    ).resolves.toEqual(["reply"]);
    expect(completeUserOnboarding).toHaveBeenCalledTimes(1);
    expect(storedState).toBeNull();
  });

  test("persists a fallback timezone when an existing state lacks one", async () => {
    storedState = { ageEligible: true, name: "Ari" };
    extracted = { detectedLocale: "en" };

    await handleOnboarding(
      log,
      "usr_timezone",
      "more details",
      "+15555550124",
      "en",
      "America/New_York",
      "US",
    );

    expect(storedState?.timezone).toBe("America/New_York");
    expect(completeUserOnboarding).toHaveBeenCalledTimes(1);
  });
});
