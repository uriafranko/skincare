import { describe, expect, test } from "bun:test";
import { getOnboardingNextAction } from "../onboarding";

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
