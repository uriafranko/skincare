import { describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@skintext/shared";
import { createSharedMock } from "./shared-mock";

mock.module("@skintext/shared", () => createSharedMock());

const { buildSkintextSystemPrompt } = await import("../prompts/main");
const {
  USER_REMINDER_CLOSE_TAG,
  USER_REMINDER_OPEN_TAG,
  USER_REMINDER_TAG_EXAMPLE,
  wrapUserReminder,
} = await import("../user-reminder");
const { ONBOARDING_INSTRUCTIONS } = await import("../prompts/onboarding");
const { buildCorePrompt } = await import("../prompts/core");
const { buildConversationPolicy, buildResponseShapePolicy } = await import("../prompts/foundation");
const { buildMainAccountState, mainAccountStateCacheKey, serializeMainAccountState } = await import(
  "../prompts/context"
);

const baseAccount = {
  id: "usr_test123",
  phone: "+15555550123",
  locale: "en",
  timezone: "America/New_York",
  timezoneConfirmed: true,
  country: "US",
  styleOfferState: "shown" as const,
  photoRetentionConsentedAt: null,
  photoRetentionConsentVersion: null,
  photoRetentionOfferShownAt: null,
  onboardingComplete: true,
  consentedAt: "2026-07-26T00:00:00Z",
  consentVersion: "2026-07-26",
  createdAt: "2026-07-26T00:00:00Z",
};

const baseContext = {
  userId: "usr_test123",
  localeName: "English",
  locale: "en",
  timezone: "America/New_York",
  localDate: "2026-07-31",
  userAccount: baseAccount,
  riskState: "routine" as const,
  shouldOfferStyle: false,
  shouldOfferPhotoRetention: false,
  hasImage: false,
  isScheduledEvent: false,
  streak: 4,
} satisfies AgentContext;

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { ...baseContext, ...overrides };
}

describe("buildSkintextSystemPrompt", () => {
  test("composes every trusted-core policy module", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).toContain("Your name is Lily");
    expect(prompt).toContain("You are AI, not a human");
    expect(prompt).toContain("ROLE AND IDENTITY");
    expect(prompt).toContain("CONVERSATION POLICY");
    expect(prompt).toContain("RESPONSE SHAPE");
    expect(prompt).toContain("CONTEXT PRIORITY");
    expect(prompt).toContain("RUNTIME CONTEXT");
    expect(prompt).toContain("SAFETY POLICY");
    expect(prompt).toContain("BODY-IMAGE POLICY");
    expect(prompt).toContain("COMMERCE POLICY");
    expect(prompt).toContain("MEMORY AND PRIVACY POLICY");
    expect(prompt).toContain("IMAGE POLICY");
    expect(prompt).toContain("PRODUCT AND ROUTINE GUIDANCE");
    expect(prompt).toContain("ACTION AND TOOL POLICY");
    expect(prompt).toContain("SCHEDULED EVENTS");
  });

  test("keeps all user and turn state out of the static system prompt", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).not.toContain("TURN CONTEXT");
    expect(prompt).toContain("Working memory is the compact current source");
    expect(prompt).not.toContain("Name: Alice");
    expect(prompt).not.toContain("Skin type: combination");
    expect(prompt).not.toContain("Allergies/avoids: fragrance");
    expect(prompt).not.toContain("Gentle Cleanser");
    expect(prompt).not.toContain("Adherence streak: 4");
    expect(prompt).not.toContain("America/New_York");
    expect(prompt).not.toContain("2026-07-31");
    expect(prompt).not.toContain("Image attached:");
    expect(prompt).toContain("exact language of the user's latest message");
  });

  test("keeps routine-log payloads out of the static system prompt", () => {
    const prompt = buildSkintextSystemPrompt();

    expect(prompt).not.toContain("routine_1");
    expect(prompt).not.toContain("Barrier Cream");
    expect(prompt).not.toContain("less tightness");
    expect(prompt).not.toContain("RECENT VERIFIED ROUTINE HISTORY");
    expect(prompt).toContain("retained message history and observational memory");
    expect(prompt).toContain("verified routine-log actions");
  });

  test("includes safety, privacy, commercial, and action invariants", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Never confirm that the user is ugly");
    expect(prompt).toContain('"Buy nothing"');
    expect(prompt).toContain("latest explicit addition, correction, stop, removal, or forget");
    expect(prompt).toContain("Raw image bytes and private URLs");
    expect(prompt).toContain("Keep only one active skincare experiment");
    expect(prompt).toContain("Every user-visible reply must be plain text");
    expect(prompt).toContain("Never use Markdown syntax");
    expect(prompt).toContain("Promise a future message only after");
    expect(prompt).toContain("save it with the feedback action");
    expect(prompt).toContain("one clear purpose and one obvious response");
    expect(prompt).toContain("Invite replies in ordinary language");
    expect(prompt).toContain("not system receipts");
    expect(prompt).toContain("These are internal writing instructions");
  });

  test("turns product guidance into a natural, bounded conversation", () => {
    const prompt = buildSkintextSystemPrompt();

    expect(prompt).toContain('Treat "Can I use this?"');
    expect(prompt).toContain("Lead with a clear bottom line in natural language");
    expect(prompt).toContain("no more than four short sentences");
    expect(prompt).toContain("Do not print mechanical KEEP/MOVE/PAUSE labels");
    expect(prompt).toContain('Prefer a small "tonight" routine');
    expect(prompt).toContain("A photo does not add a product");
    expect(prompt).toContain("never require category codes");
    expect(prompt).toContain("never proof that one product caused the result");
  });

  test("defines response shape and type-specific context precedence", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).toContain("Do not restate or paraphrase the user's request");
    expect(prompt).toContain('"Let me know if you need anything else"');
    expect(prompt).toContain("Do not repeat the same question or recommendation");
    expect(prompt).toContain("their communication style is playful_guide");
    expect(prompt).toContain("latest explicit user statement wins");
    expect(prompt).toContain("current attachment wins");
    expect(prompt).toContain("verified operational records win");
    expect(prompt).toContain("Newer retained conversation wins");
  });

  test("does not inject experiment state outside working memory", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).not.toContain("Use azelaic acid every other night");
    expect(prompt).not.toContain("Redness is unchanged");
    expect(prompt).toContain("experiment state as conversational memory");
  });

  test("treats scheduled reminder tags as internal input", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).toContain(USER_REMINDER_TAG_EXAMPLE);
    expect(prompt).toContain("internal scheduled events");
    expect(prompt).toContain("Reply in the user's saved locale");
    expect(prompt).toContain("Continue the same user's ongoing conversation");
    expect(prompt).toContain("working memory, retained history, observational memory");
    expect(prompt).toContain("load them with the verified routine-log actions");
    expect(prompt).toContain("use judgment rather than a fixed count");
    expect(prompt).toContain("first tell the user you are considering pausing");
    expect(prompt).toContain("if there is still no user reply after that notice");
    expect(prompt).toContain("continuation of the relationship");
    expect(prompt).toContain("Never present a command menu");
    expect(prompt).toContain(`Never mention ${USER_REMINDER_OPEN_TAG}`);
    expect(wrapUserReminder("Check whether irritation improved.")).toBe(
      `${USER_REMINDER_OPEN_TAG}\nCheck whether irritation improved.\n${USER_REMINDER_CLOSE_TAG}`,
    );
  });

  test("does not inject saved image metadata into system context", () => {
    const prompt = buildSkintextSystemPrompt();
    expect(prompt).not.toContain("img_123");
    expect(prompt).not.toContain("is this irritation improving?");
  });
});

describe("prompt module boundaries", () => {
  test("keeps the foundation free of skincare-domain policy", () => {
    const foundation = [buildConversationPolicy(), buildResponseShapePolicy()].join("\n\n");

    expect(foundation).not.toMatch(/skincare|dermatolog|photo|experiment/i);
  });

  test("keeps stable shared behavior in core without main or runtime state", () => {
    const core = buildCorePrompt();

    expect(core).toContain("ROLE AND IDENTITY");
    expect(core).toContain("SAFETY POLICY");
    expect(core).not.toContain("ACTION AND TOOL POLICY");
    expect(core).not.toContain("MEMORY AND PRIVACY POLICY");
    expect(core).not.toContain("TURN CONTEXT");
  });

  test("serializes only slow-changing verified facts into account-state", () => {
    const state = buildMainAccountState(makeContext());
    const serialized = serializeMainAccountState(state);

    expect(state).toEqual({
      version: 1,
      mode: "main",
      locale: { code: "en", name: "English" },
      localDate: "2026-07-31",
      timezone: { value: "America/New_York", confirmed: true },
      serviceConsent: {
        onboardingComplete: true,
        consented: true,
        version: "2026-07-26",
      },
      photoRetention: { enabled: false, consentVersion: null },
      adherenceStreak: 4,
    });
    expect(serialized).not.toContain("usr_test123");
    expect(serialized).not.toContain("riskState");
    expect(serialized).not.toContain("hasImage");
    expect(serialized).not.toContain("shouldOffer");
    expect(serialized).not.toContain("isScheduledEvent");
  });

  test("does not invalidate account-state for per-turn-only changes", () => {
    const first = buildMainAccountState(makeContext());
    const second = buildMainAccountState(
      makeContext({
        riskState: "escalation",
        hasImage: true,
        isScheduledEvent: true,
        shouldOfferStyle: true,
        shouldOfferPhotoRetention: true,
      }),
    );

    expect(mainAccountStateCacheKey(first)).toBe(mainAccountStateCacheKey(second));
  });

  test("composes onboarding from core plus onboarding-only rules", () => {
    expect(ONBOARDING_INSTRUCTIONS).toContain("ROLE AND IDENTITY");
    expect(ONBOARDING_INSTRUCTIONS).toContain("ONBOARDING MODE");
    expect(ONBOARDING_INSTRUCTIONS).not.toContain("ACTION AND TOOL POLICY");
    expect(ONBOARDING_INSTRUCTIONS).not.toContain("MEMORY AND PRIVACY POLICY");
  });

  test("uses the exact same ordered shared policy prefix for main and onboarding", () => {
    const core = buildCorePrompt();

    expect(buildSkintextSystemPrompt().startsWith(`${core}\n\n`)).toBe(true);
    expect(ONBOARDING_INSTRUCTIONS.startsWith(`${core}\n\n`)).toBe(true);
  });

  test("includes each policy section exactly once in each composed prompt", () => {
    const sharedHeadings = [
      "ROLE AND IDENTITY",
      "CONVERSATION POLICY",
      "RESPONSE SHAPE",
      "SAFETY POLICY",
      "BODY-IMAGE POLICY",
    ];
    const mainOnlyHeadings = [
      "CONTEXT PRIORITY",
      "RUNTIME CONTEXT",
      "COMMERCE POLICY",
      "MEMORY AND PRIVACY POLICY",
      "IMAGE POLICY",
      "PRODUCT AND ROUTINE GUIDANCE",
      "ACTION AND TOOL POLICY",
      "SCHEDULED EVENTS",
    ];
    const count = (prompt: string, heading: string) =>
      prompt.split("\n").filter((line) => line === heading || line.startsWith(`${heading} (`))
        .length;
    const main = buildSkintextSystemPrompt();
    const core = buildCorePrompt();

    for (const heading of sharedHeadings) {
      expect(count(core, heading)).toBe(1);
    }

    for (const heading of [...sharedHeadings, ...mainOnlyHeadings]) {
      expect(count(main, heading)).toBe(1);
    }
    for (const heading of [...sharedHeadings, "ONBOARDING MODE"]) {
      expect(count(ONBOARDING_INSTRUCTIONS, heading)).toBe(1);
    }
    for (const heading of mainOnlyHeadings) {
      expect(count(ONBOARDING_INSTRUCTIONS, heading)).toBe(0);
    }
  });
});

describe("onboarding prompt source", () => {
  test("completion guidance gives immediate value without command syntax", () => {
    expect(ONBOARDING_INSTRUCTIONS).toContain("give immediate value");
    expect(ONBOARDING_INSTRUCTIONS).toContain("two- or three-step starting routine");
    expect(ONBOARDING_INSTRUCTIONS).toContain("do not invent a generic");
    expect(ONBOARDING_INSTRUCTIONS).toContain("tell you how the routine went");
    expect(ONBOARDING_INSTRUCTIONS).toContain("Invite ordinary-language replies");
  });

  test("setup guidance localizes consent and CTA copy", () => {
    expect(ONBOARDING_INSTRUCTIONS).toContain("Tell them to reply AGREE");
    expect(ONBOARDING_INSTRUCTIONS).toContain("https://skintext.ai/terms");
    expect(ONBOARDING_INSTRUCTIONS).toContain("https://skintext.ai/privacy");
    expect(ONBOARDING_INSTRUCTIONS).toContain("localized low-friction CTA");
    expect(ONBOARDING_INSTRUCTIONS).not.toContain("proposedNextAction");
  });

  test("onboarding matches the user's language, code-switching, and conversational voice", () => {
    expect(ONBOARDING_INSTRUCTIONS).toContain("latest message as the primary voice reference");
    expect(ONBOARDING_INSTRUCTIONS).toContain("naturally code-switch");
    expect(ONBOARDING_INSTRUCTIONS).toContain("slang level");
    expect(ONBOARDING_INSTRUCTIONS).toContain("never force or invent slang");
    expect(ONBOARDING_INSTRUCTIONS).toContain(
      "plain text because iMessage does not render Markdown",
    );
    expect(ONBOARDING_INSTRUCTIONS).toContain("Do not restate or paraphrase the user's request");
    expect(ONBOARDING_INSTRUCTIONS).toContain("Do not repeat the same question or recommendation");
    expect(ONBOARDING_INSTRUCTIONS).toContain("Do not introduce emoji unless the user used emoji");
    expect(ONBOARDING_INSTRUCTIONS).toContain(
      "Do not make every reply start with an acknowledgment",
    );
    expect(ONBOARDING_INSTRUCTIONS).toContain("Keep image guidance transient");
    expect(ONBOARDING_INSTRUCTIONS).toContain("Never expose an IANA timezone");
    expect(ONBOARDING_INSTRUCTIONS).toContain("Do not restate skin type");
  });
});
