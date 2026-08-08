import { describe, expect, test } from "bun:test";
import { buildOnboardingWorkingMemory, skintextWorkingMemorySchema } from "../working-memory";

describe("Skintext working memory", () => {
  test("initializes current conversational state directly from onboarding", () => {
    const memory = buildOnboardingWorkingMemory({
      name: "Alex",
      replyLanguage: "en",
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
    expect(memory.profile).not.toHaveProperty("timezone");
    expect(memory.products).toEqual([
      { name: "Barrier Cream", status: "current", source: "user" },
      { name: "Daily SPF", status: "current", source: "user" },
    ]);
    expect(memory.currentRoutine).toBeNull();
    expect(memory.activeExperiment).toBeNull();
  });

  test("allows observation to clear current arrays and active experiment", () => {
    const result = skintextWorkingMemorySchema.safeParse({
      profile: { concerns: [], goals: [], allergiesAndAvoids: [] },
      products: [],
      currentRoutine: {
        evening: [
          { name: "cleanse", productName: "Gentle Cleanser" },
          { name: "moisturize", productName: "Barrier Cream" },
        ],
        minimumEvening: [{ name: "moisturize", productName: "Barrier Cream" }],
        lastConfirmedAt: "2026-08-08",
      },
      activeExperiment: null,
      recentExperimentOutcome: {
        change: "Use azelaic acid every other night",
        outcome: "no_change",
      },
      pendingFollowUps: [],
    });

    expect(result.success).toBe(true);
  });

  test("supports confirmed products and a bounded one-change plan", () => {
    const result = skintextWorkingMemorySchema.safeParse({
      products: [
        {
          name: "Azelaic Acid 10%",
          status: "current",
          placement: "after cleansing, before moisturizer",
          cadence: "two evenings a week",
          source: "photo_confirmed",
          lastConfirmedAt: "2026-08-08",
        },
      ],
      activeExperiment: {
        change: "add azelaic acid",
        baseline: "cheeks feel calm",
        focus: "comfort",
        cadence: "two evenings a week",
        stopConditions: ["persistent burning", "swelling"],
        reviewAt: "after two weeks",
      },
    });

    expect(result.success).toBe(true);
  });

  test("strips legacy timezone values from conversational working memory", () => {
    const result = skintextWorkingMemorySchema.parse({
      profile: {
        name: "Alex",
        timezone: "Asia/Jerusalem",
      },
    });

    expect(result.profile).toEqual({ name: "Alex" });
  });
});
