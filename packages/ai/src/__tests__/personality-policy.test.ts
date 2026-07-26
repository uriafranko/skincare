import { describe, expect, mock, test } from "bun:test";
import type { AgentContext, CommunicationStyle, UserProfile } from "@skintext/shared";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());

const {
  buildBodyImagePolicy,
  buildCommercePolicy,
  buildConversationPolicy,
  buildImagePolicy,
  buildMemoryPolicy,
  buildSafetyPolicy,
} = await import("../personality-policy");
const { deriveMinimumRiskState, shouldOfferCommunicationStyle, shouldOfferPhotoRetention } =
  await import("../risk");
const { buildSkintextSystemPrompt } = await import("../prompts");

function profile(style: CommunicationStyle = "clear_expert"): UserProfile {
  return {
    id: "usr_test",
    phone: "encrypted",
    name: "Alex",
    locale: "en",
    timezone: "UTC",
    timezoneConfirmed: true,
    country: "US",
    skinType: "combination",
    sensitivity: "medium",
    concerns: ["redness"],
    goals: ["simpler routine"],
    allergies: ["fragrance"],
    currentProducts: [],
    routinePreference: "simple",
    communicationStyle: style,
    styleOfferState: "chosen",
    photoRetentionConsentedAt: null,
    photoRetentionConsentVersion: null,
    photoRetentionOfferShownAt: null,
    onboardingComplete: true,
    consentedAt: "2026-07-26T00:00:00.000Z",
    consentVersion: "2026-07-26",
    createdAt: "2026-07-26T00:00:00.000Z",
  };
}

function context(style: CommunicationStyle = "clear_expert"): AgentContext {
  return {
    userId: "usr_test",
    userName: "Alex",
    localeName: "English",
    locale: "en",
    timezone: "UTC",
    localDate: "2026-07-26",
    userProfile: profile(style),
    riskState: "routine",
    shouldOfferStyle: false,
    shouldOfferPhotoRetention: false,
    hasImage: false,
    isScheduledEvent: false,
    activeExperiment: null,
    streak: null,
    products: [],
    recentRoutineLogs: [],
  };
}

describe("personality v1 policies", () => {
  test("uses escalation precedence over caution keywords", () => {
    expect(deriveMinimumRiskState("It is burning and my eyelid is swelling")).toBe("escalation");
    expect(deriveMinimumRiskState("This stings and I am pregnant")).toBe("caution");
    expect(deriveMinimumRiskState("Where does moisturizer go?")).toBe("routine");
  });

  test("keeps safety, commerce, memory, image, and body-image rules style invariant", () => {
    const styles: CommunicationStyle[] = [
      "clear_expert",
      "gentle_coach",
      "playful_guide",
      "straight_talk",
    ];
    const invariantPolicies = styles.map((style) => {
      const ctx = context(style);
      return [
        buildSafetyPolicy(ctx),
        buildCommercePolicy(),
        buildMemoryPolicy(ctx),
        buildImagePolicy(ctx),
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

  test("composes canonical priority and prohibited-pattern coverage into the prompt", () => {
    const ctx = context();
    ctx.activeExperiment = {
      id: "experiment_1",
      userId: "usr_test",
      change: "Use azelaic acid every other night",
      startedAt: "2026-07-20T00:00:00.000Z",
      status: "active",
      createdAt: "2026-07-20T00:00:00.000Z",
    };
    const prompt = buildSkintextSystemPrompt(ctx);
    expect(prompt).toContain("Structured profile, verified products/logs");
    expect(prompt).toContain("authoritative over conversational or observational memory");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Never confirm that the user is ugly");
    expect(prompt).toContain("Never imply human lived experience");
    expect(prompt).toContain("Never manufacture urgency");
    expect(prompt).toContain("Keep other variables stable");
    expect(prompt).toContain("Never copy the existing profile into an update");
    expect(buildConversationPolicy(ctx)).toContain("one to three prioritized actions");
  });

  test("matches the user's live language and conversational voice without caricature", () => {
    const policy = buildConversationPolicy(context());
    expect(policy).toContain("latest message as the primary voice reference");
    expect(policy).toContain("if they naturally code-switch");
    expect(policy).toContain("slang level");
    expect(policy).toContain("capitalization, punctuation, and emoji use");
    expect(policy).toContain("never force or invent slang");
    expect(policy).toContain("safety, accuracy, and boundaries always win");
  });
});
