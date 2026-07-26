import { describe, expect, mock, test } from "bun:test";
import { rejectUnder16PendingOnboarding } from "../onboarding-eligibility";

describe("age-gated onboarding eligibility", () => {
  test("deletes the pending account before returning the under-16 boundary", async () => {
    const deletePendingUser = mock(() => Promise.resolve());
    const replies = await rejectUnder16PendingOnboarding({
      extracted: { ageEligible: false, detectedLocale: "en" },
      userId: "usr_under_16",
      reply: "Skintext is for people 16 or older, so I can't continue setup.",
      deletePendingUser,
    });

    expect(replies).toEqual(["Skintext is for people 16 or older, so I can't continue setup."]);
    expect(deletePendingUser).toHaveBeenCalledWith("usr_under_16");
  });

  test("does not delete an eligible user", async () => {
    const deletePendingUser = mock(() => Promise.resolve());
    expect(
      await rejectUnder16PendingOnboarding({
        extracted: { ageBand: "16_17", ageEligible: true },
        userId: "usr_teen",
        reply: "Continue",
        deletePendingUser,
      }),
    ).toBeNull();
    expect(deletePendingUser).not.toHaveBeenCalled();
  });
});
