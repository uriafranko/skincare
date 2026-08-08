import { describe, expect, test } from "bun:test";
import { getOnboardingNextAction, sanitizeOnboardingExtraction } from "../onboarding";

describe("sanitizeOnboardingExtraction", () => {
  const profile = {
    name: "Dana",
    concerns: ["redness"],
    skinType: "combination" as const,
    morningReminder: "08:00",
    consented: true,
    detectedLocale: "en",
  };

  test("retains only locale before age eligibility is established", () => {
    expect(sanitizeOnboardingExtraction({}, profile)).toEqual({ detectedLocale: "en" });
  });

  test("retains the full extraction when the same message establishes eligibility", () => {
    expect(sanitizeOnboardingExtraction({}, { ...profile, ageEligible: true })).toEqual({
      ...profile,
      ageEligible: true,
    });
  });

  test("retains only the rejection signal and locale for an underage user", () => {
    expect(sanitizeOnboardingExtraction({}, { ...profile, ageEligible: false })).toEqual({
      ageEligible: false,
      detectedLocale: "en",
    });
  });

  test("does not filter later turns after eligibility is established", () => {
    expect(sanitizeOnboardingExtraction({ ageEligible: true }, profile)).toEqual(profile);
  });
});

describe("getOnboardingNextAction", () => {
  test("derives one next action from the authoritative onboarding snapshot", () => {
    expect(getOnboardingNextAction({})).toBe("ask_age");
    expect(getOnboardingNextAction({ ageEligible: false })).toBe("stop_underage");
    expect(getOnboardingNextAction({ ageEligible: true })).toBe("collect_profile");
    expect(
      getOnboardingNextAction({
        ageEligible: true,
        name: "Dana",
        concerns: ["redness"],
        skinType: "combination",
        morningReminder: "08:00",
      }),
    ).toBe("ask_timezone");
    expect(
      getOnboardingNextAction({
        ageEligible: true,
        name: "Dana",
        concerns: ["redness"],
        skinType: "combination",
      }),
    ).toBe("ask_consent");
    expect(
      getOnboardingNextAction({
        ageEligible: true,
        name: "Dana",
        concerns: ["redness"],
        skinType: "combination",
        consented: true,
      }),
    ).toBe("complete");
  });
});
