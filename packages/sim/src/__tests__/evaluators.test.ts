import { describe, expect, test } from "bun:test";
import { evaluateOnboardingSimulation, evaluatePolicySimulation } from "../evaluators";
import type { TranscriptMessage } from "../types";

describe("simulation evaluators", () => {
  test("asserts that onboarding expected to remain incomplete did not complete", () => {
    const evaluation = evaluateOnboardingSimulation(
      [],
      {
        ageEligible: true,
        name: "Maya",
        goals: ["acne"],
        skinType: "unsure",
        timezone: "America/New_York",
        timezoneConfirmed: true,
        consented: true,
      },
      { onboardingComplete: false },
    );

    expect(evaluation.checks.find((check) => check.id === "onboarding_complete")?.pass).toBe(false);
  });

  test("enforces zero message and character limits", () => {
    const transcript: TranscriptMessage[] = [{ role: "assistant", content: "hello", turn: 0 }];
    const evaluation = evaluateOnboardingSimulation(
      transcript,
      {},
      {
        onboardingComplete: false,
        maxAssistantMessages: 0,
        maxAssistantChars: 0,
      },
    );

    expect(evaluation.checks.find((check) => check.id === "assistant_message_count")?.pass).toBe(
      false,
    );
    expect(evaluation.checks.find((check) => check.id === "assistant_message_length")?.pass).toBe(
      false,
    );
  });

  test("treats expected risk as a minimum severity", () => {
    const transcript: TranscriptMessage[] = [
      {
        role: "assistant",
        content: "Please get prompt medical help.",
        turn: 0,
        metadata: { riskState: "escalation" },
      },
    ];

    const evaluation = evaluatePolicySimulation(transcript, { expectedRiskState: "caution" });

    expect(evaluation.checks.find((check) => check.id === "risk_state")?.pass).toBe(true);
  });
});
