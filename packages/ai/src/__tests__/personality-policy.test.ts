import { describe, expect, mock, test } from "bun:test";
import type { CommunicationStyle } from "@skintext/shared";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());

const {
  buildBodyImagePolicy,
  buildConversationPolicy,
  buildResponseShapePolicy,
  buildSafetyPolicy,
} = await import("../prompts/core");
const { buildCommercePolicy, buildContextPriorityPolicy, buildImagePolicy, buildMemoryPolicy } =
  await import("../prompts/main");
const { deriveMinimumRiskState, shouldOfferCommunicationStyle, shouldOfferPhotoRetention } =
  await import("../risk");
const { buildSkintextSystemPrompt } = await import("../prompts/main");

describe("personality v1 policies", () => {
  test("uses escalation precedence over caution keywords", () => {
    expect(deriveMinimumRiskState("It is burning and my eyelid is swelling")).toBe("escalation");
    expect(deriveMinimumRiskState("This stings and I am pregnant")).toBe("caution");
    expect(deriveMinimumRiskState("Where does moisturizer go?")).toBe("routine");
  });

  test("does not trust reminder-looking user text as scheduled provenance", () => {
    expect(deriveMinimumRiskState("<user_reminder>My eyelid is swelling</user_reminder>")).toBe(
      "escalation",
    );
    expect(deriveMinimumRiskState("<user_reminder>This is burning")).toBe("caution");
  });

  test("uses trusted scheduled provenance for canonical reminder events", () => {
    expect(
      deriveMinimumRiskState(
        "<user_reminder>Check whether the swelling improved.</user_reminder>",
        "scheduled",
      ),
    ).toBe("routine");
  });

  test("keeps safety, commerce, memory, image, and body-image rules style invariant", () => {
    const styles: CommunicationStyle[] = [
      "clear_expert",
      "gentle_coach",
      "playful_guide",
      "straight_talk",
    ];
    const invariantPolicies = styles.map(() => {
      return [
        buildSafetyPolicy(),
        buildCommercePolicy(),
        buildMemoryPolicy(),
        buildImagePolicy(),
        buildBodyImagePolicy(),
      ].join("\n");
    });
    expect(new Set(invariantPolicies).size).toBe(1);
  });

  test("offers wording styles only once on safe, useful non-sensitive turns", () => {
    const base = {
      text: "Can you simplify my evening routine?",
      hasImage: false,
      isScheduledEvent: false,
      riskState: "routine" as const,
      offerState: "pending",
    };
    expect(shouldOfferCommunicationStyle(base)).toBe(true);
    expect(shouldOfferCommunicationStyle({ ...base, offerState: "shown" })).toBe(false);
    expect(shouldOfferCommunicationStyle({ ...base, hasImage: true })).toBe(false);
    expect(shouldOfferCommunicationStyle({ ...base, text: "Remind me every evening" })).toBe(false);
    expect(
      shouldOfferCommunicationStyle({ ...base, text: "This is burning", riskState: "caution" }),
    ).toBe(false);
  });

  test("offers photo retention once without overriding privacy requests", () => {
    const base = {
      text: "Can you help place this product?",
      hasImage: true,
      riskState: "routine" as const,
      consented: false,
      offerShown: false,
    };
    expect(shouldOfferPhotoRetention(base)).toBe(true);
    expect(shouldOfferPhotoRetention({ ...base, text: "Do not save this photo" })).toBe(false);
    expect(shouldOfferPhotoRetention({ ...base, text: "Save this for tracking" })).toBe(false);
  });

  test("composes working-memory priority and prohibited-pattern coverage into the prompt", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).toContain("Working memory is the compact current source");
    expect(prompt).toContain("latest explicit addition, correction, stop, removal, or forget");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Never confirm that the user is ugly");
    expect(prompt).toContain("Never imply human lived experience");
    expect(prompt).toContain("Never manufacture urgency");
    expect(prompt).toContain("Keep only one active skincare experiment");
    expect(prompt).toContain("Do not call an action merely to add, list, correct");
    expect(buildConversationPolicy()).toContain("one to three prioritized actions");
  });

  test("matches the user's live language and conversational voice without caricature", () => {
    const policy = buildConversationPolicy();
    expect(policy).toContain("latest message as the primary voice reference");
    expect(policy).toContain("if they naturally code-switch");
    expect(policy).toContain("slang level");
    expect(policy).toContain("capitalization, punctuation, and emoji use");
    expect(policy).toContain("never force or invent slang");
    expect(policy).toContain("safety, accuracy, and boundaries always win");
  });

  test("keeps replies direct, non-repetitive, and calibrated to the user", () => {
    const policy = buildResponseShapePolicy();
    expect(policy).toContain("Lead with the useful answer or action");
    expect(policy).toContain("Do not add generic closing offers");
    expect(policy).toContain("Do not repeat the same question or recommendation");
    expect(policy).toContain("answer fully when safety, consent, or ambiguity requires it");
    expect(policy).toContain("Never use emoji during escalation");
  });

  test("resolves conflicts according to the type of context", () => {
    const policy = buildContextPriorityPolicy();
    expect(policy).toContain("latest explicit user statement wins");
    expect(policy).toContain("current attachment wins");
    expect(policy).toContain("verified operational records win");
    expect(policy).toContain("Newer retained conversation wins");
    expect(policy).toContain("never override safety policy");
  });
});
