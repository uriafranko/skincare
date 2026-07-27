import { describe, expect, test } from "bun:test";
import { buildOnboardingWorkingMemory, skintextWorkingMemorySchema } from "../working-memory";

describe("Skintext working memory", () => {
  test("initializes current conversational state directly from onboarding", () => {
    const memory = buildOnboardingWorkingMemory({
      name: "Alex",
      replyLanguage: "en",
      timezone: "Asia/Jerusalem",
      skinType: "combination",
      sensitivity: "medium",
      concerns: ["redness"],
      goals: ["simple routine"],
      allergiesAndAvoids: ["fragrance"],
      currentProducts: ["Barrier Cream", "Daily SPF"],
      routinePreference: "simple",
      communicationStyle: "straight_talk",
    });

    expect(skintextWorkingMemorySchema.safeParse(memory).success).toBe(true);
    expect(memory.profile?.communicationStyle).toBe("straight_talk");
    expect(memory.products?.map((product) => product.name)).toEqual(["Barrier Cream", "Daily SPF"]);
    expect(memory.activeExperiment).toBeNull();
  });

  test("allows observation to clear current arrays and active experiment", () => {
    const result = skintextWorkingMemorySchema.safeParse({
      profile: { concerns: [], goals: [], allergiesAndAvoids: [] },
      products: [],
      activeExperiment: null,
      recentExperimentOutcome: {
        change: "Use azelaic acid every other night",
        outcome: "no_change",
      },
      pendingFollowUps: [],
    });

    expect(result.success).toBe(true);
  });
});
