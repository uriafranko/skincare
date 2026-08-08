import { createHash } from "node:crypto";
import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import {
  getMissingFields,
  getOnboardingNextAction,
  isValidTimeZone,
  mergeOnboardingState,
  type OnboardingNextAction,
  type OnboardingState,
} from "@skintext/shared";
import { z } from "zod";
import { ensureSkintextThread, skintextMemory } from "./memory";
import { getDefaultModelName, getDefaultProviderOptions } from "./model-runtime";
import { toMastraModelName } from "./models";
import { ONBOARDING_INSTRUCTIONS } from "./prompts/onboarding";
import { skintextThreadId } from "./runtime";
import { normalizeAssistantText } from "./text";

export { ONBOARDING_INSTRUCTIONS } from "./prompts/onboarding";

const ONBOARDING_PROMPT_CACHE_KEY = "lily-onboarding-v6";
const ONBOARDING_STATE_SIGNAL_ID = "onboarding";

export const onboardingExtractionSchema = z.object({
  ageEligible: z
    .boolean()
    .nullable()
    .describe(
      "True only when this message establishes that the user is at least 16; false only when it establishes they are under 16; otherwise null.",
    ),
  name: z.string().nullable().describe("User's first name. Null if not mentioned."),
  skinType: z
    .enum(["dry", "oily", "combination", "normal", "unsure"])
    .nullable()
    .describe("Skin type if mentioned. Use unsure if they say they do not know."),
  sensitivity: z
    .enum(["low", "medium", "high", "unsure"])
    .nullable()
    .describe("Sensitivity level if mentioned. Use unsure if they do not know."),
  concerns: z.array(z.string()).nullable().describe("Skin concerns stated in this message."),
  goals: z.array(z.string()).nullable().describe("Skincare goals stated in this message."),
  allergies: z
    .array(z.string())
    .nullable()
    .describe("Known allergies, sensitivities, or ingredients to avoid."),
  currentProducts: z.array(z.string()).nullable().describe("Products they currently use."),
  routinePreference: z
    .enum(["simple", "standard", "detailed"])
    .nullable()
    .describe("How involved they want the routine to be."),
  morningReminder: z
    .string()
    .nullable()
    .describe("Explicit morning reminder time normalized to HH:mm, otherwise null."),
  eveningReminder: z
    .string()
    .nullable()
    .describe("Explicit evening reminder time normalized to HH:mm, otherwise null."),
  timezone: z
    .string()
    .nullable()
    .describe("IANA timezone derived only from a city or timezone the user explicitly states."),
  consented: z
    .boolean()
    .nullable()
    .describe("True only after explicit combined skincare-data storage and Terms consent."),
  detectedLocale: z
    .string()
    .nullable()
    .describe("BCP-47 language code of the user's latest message."),
  reply: z.string().describe("The concise plain-text iMessage reply for that next action."),
});

export type OnboardingExtraction = z.infer<typeof onboardingExtractionSchema>;

const CONSENT_ONLY_REPLY =
  "One last thing: reply AGREE if I can save your skincare data for reminders and logs and you accept the Terms of Use: https://skintext.ai/terms. Privacy Policy: https://skintext.ai/privacy. You can delete your data anytime.";
const ENGLISH_AGE_GATE_REPLY = "Hey, I'm Lily. Before we get started, are you 16 or older?";
const ENGLISH_UNDER_16_REPLY =
  "I can only help people who are 16 or older, so I can't continue setup.";
const ENGLISH_COMPLETION_FALLBACK =
  "You're all set. Next time you do your routine, tell me what you used and how it felt. And if you're ever staring at a product wondering where it fits, send me a photo.";

function onboardingProviderOptions() {
  const providerOptions = getDefaultProviderOptions();
  return {
    ...providerOptions,
    openai: {
      ...providerOptions.openai,
      promptCacheKey: ONBOARDING_PROMPT_CACHE_KEY,
    },
  };
}

export const skintextOnboardingAgent = new Agent({
  id: "skintext-onboarding-agent",
  name: "Lily Onboarding",
  model: getDefaultModelName(),
  defaultOptions: { providerOptions: onboardingProviderOptions() },
  memory: skintextMemory,
  instructions: ONBOARDING_INSTRUCTIONS,
});

export interface OnboardingContext {
  isFirstMessage: boolean;
  timezone: string;
  locale: string;
  userId?: string;
  imageUrl?: string;
}

export interface OnboardingTurnInput {
  text: string;
  imageUrl?: string;
  state: OnboardingState;
  context: OnboardingContext;
}

export type OnboardingGenerator = (input: OnboardingTurnInput) => Promise<OnboardingExtraction>;

export interface OnboardingResult {
  extracted: Partial<OnboardingState>;
  nextAction: OnboardingNextAction;
  reply: string;
}

interface OnboardingStateProjection {
  version: 1;
  mode: "onboarding";
  active: boolean;
  isFirstMessage?: boolean;
  locale?: string;
  currentAction: OnboardingNextAction;
  missingFields: ReturnType<typeof getMissingFields>;
  collected?: {
    ageEligible: boolean | null;
    name: string | null;
    skinType: OnboardingState["skinType"] | null;
    sensitivity: OnboardingState["sensitivity"] | null;
    concerns: readonly string[];
    goals: readonly string[];
    allergies: readonly string[];
    currentProducts: readonly string[];
    routinePreference: OnboardingState["routinePreference"] | null;
    morningReminder: string | null;
    eveningReminder: string | null;
    confirmedTimezone: string | null;
    consented: boolean;
  };
}

export function onboardingThreadId(userId: string): string {
  return skintextThreadId(userId);
}

export function buildOnboardingStateProjection(
  state: OnboardingState,
  context: OnboardingContext,
): OnboardingStateProjection {
  const currentAction = getOnboardingNextAction(state);
  if (currentAction === "complete") {
    return {
      version: 1,
      mode: "onboarding",
      active: false,
      currentAction,
      missingFields: [],
    };
  }

  return {
    version: 1,
    mode: "onboarding",
    active: true,
    isFirstMessage: context.isFirstMessage,
    locale: state.detectedLocale ?? context.locale,
    currentAction,
    missingFields: getMissingFields(state),
    collected: {
      ageEligible: state.ageEligible ?? null,
      name: state.name ?? null,
      skinType: state.skinType ?? null,
      sensitivity: state.sensitivity ?? null,
      concerns: state.concerns ?? [],
      goals: state.goals ?? [],
      allergies: state.allergies ?? [],
      currentProducts: state.currentProducts ?? [],
      routinePreference: state.routinePreference ?? null,
      morningReminder: state.morningReminder ?? null,
      eveningReminder: state.eveningReminder ?? null,
      confirmedTimezone: state.timezoneConfirmed ? (state.timezone ?? null) : null,
      consented: state.consented === true,
    },
  };
}

function stateCacheKey(projection: OnboardingStateProjection): string {
  return `onboarding:${createHash("sha256").update(JSON.stringify(projection)).digest("hex")}`;
}

async function persistOnboardingStateSignal(
  userId: string,
  state: OnboardingState,
  context: OnboardingContext,
): Promise<void> {
  const threadId = onboardingThreadId(userId);
  const projection = buildOnboardingStateProjection(state, context);
  await ensureSkintextThread(userId);
  const signal = await skintextOnboardingAgent.sendStateSignal(
    {
      id: ONBOARDING_STATE_SIGNAL_ID,
      mode: "snapshot",
      tagName: "onboarding-state",
      cacheKey: stateCacheKey(projection),
      contents: JSON.stringify(projection),
      value: projection,
    },
    {
      resourceId: userId,
      threadId,
      ifActive: { behavior: "persist" },
      ifIdle: { behavior: "persist" },
    },
  );

  if (signal.skipped) return;
  const accepted = await signal.accepted;
  if (accepted.action !== "persist") {
    throw new Error(`Unexpected onboarding state-signal action: ${accepted.action}.`);
  }
  await signal.persisted;
}

function createStatelessGenerator(model: MastraModelConfig): OnboardingGenerator {
  const agent = new Agent({
    id: "skintext-onboarding-simulator",
    name: "Lily Onboarding Simulator",
    model,
    defaultOptions: { providerOptions: onboardingProviderOptions() },
    instructions: ONBOARDING_INSTRUCTIONS,
  });

  return async (input) => {
    const projection = buildOnboardingStateProjection(input.state, input.context);
    const prompt = `<onboarding-state>${JSON.stringify(projection)}</onboarding-state>\n\nUSER MESSAGE:\n${input.text || "[User sent a skincare or product photo without text]"}`;
    const message = input.imageUrl
      ? [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: prompt },
              { type: "image" as const, image: input.imageUrl },
            ],
          },
        ]
      : prompt;
    const result = await agent.generate(message, {
      structuredOutput: { schema: onboardingExtractionSchema },
    });
    return result.object;
  };
}

let defaultStatelessGenerator: OnboardingGenerator | undefined;

export function createOnboardingGenerator(modelName?: string): OnboardingGenerator {
  if (modelName) return createStatelessGenerator(toMastraModelName(modelName));

  return async (input) => {
    if (!defaultStatelessGenerator) {
      defaultStatelessGenerator = createStatelessGenerator(getDefaultModelName());
    }
    return defaultStatelessGenerator(input);
  };
}

async function generateThreadedOnboarding(
  input: OnboardingTurnInput,
): Promise<OnboardingExtraction> {
  // Keep raw pixels out of onboarding history before service consent. The
  // authoritative text/profile state is still supplied in the projection.
  if (input.imageUrl) return createOnboardingGenerator()(input);

  const userId = input.context.userId;
  if (!userId) return createOnboardingGenerator()(input);

  const threadId = onboardingThreadId(userId);
  await persistOnboardingStateSignal(userId, input.state, input.context);

  const result = await skintextOnboardingAgent.generate(input.text, {
    memory: {
      resource: userId,
      thread: threadId,
      options: {
        workingMemory: { enabled: false },
        observationalMemory: false,
      },
    },
    structuredOutput: { schema: onboardingExtractionSchema },
    providerOptions: onboardingProviderOptions(),
    maxSteps: 1,
    tracingOptions: { hideInput: true, hideOutput: true },
  });
  return result.object;
}

function isEnglishGreetingOnly(text: string, locale: string): boolean {
  if (locale && !locale.toLowerCase().startsWith("en")) return false;
  return /^(?:hi|hey|hello|yo)[\s!.]*$/i.test(text.trim());
}

function isEnglishLocale(locale?: string | null): boolean {
  return !locale || locale.toLowerCase().startsWith("en");
}

function hasCompleteEnglishConsentNotice(reply: string): boolean {
  return (
    /\bAGREE\b/.test(reply) &&
    /\b(?:save|store)\b/i.test(reply) &&
    /Terms/i.test(reply) &&
    reply.includes("https://skintext.ai/terms") &&
    reply.includes("https://skintext.ai/privacy") &&
    /delete/i.test(reply)
  );
}

function extractedState(output: OnboardingExtraction, state: OnboardingState) {
  const extracted: Partial<OnboardingState> = {};
  if (output.ageEligible === true) extracted.ageEligible = true;
  if (output.ageEligible === false) extracted.ageEligible = false;
  if (output.name) extracted.name = output.name;
  if (output.skinType) extracted.skinType = output.skinType;
  if (output.sensitivity) extracted.sensitivity = output.sensitivity;
  if (output.concerns?.length) extracted.concerns = output.concerns;
  if (output.goals?.length) extracted.goals = output.goals;
  if (output.allergies?.length) extracted.allergies = output.allergies;
  if (output.currentProducts?.length) extracted.currentProducts = output.currentProducts;
  if (output.routinePreference) extracted.routinePreference = output.routinePreference;
  if (output.morningReminder) extracted.morningReminder = output.morningReminder;
  if (output.eveningReminder) extracted.eveningReminder = output.eveningReminder;
  if (output.timezone && isValidTimeZone(output.timezone)) {
    extracted.timezone = output.timezone;
    extracted.timezoneConfirmed = true;
  }
  if (output.consented === true) extracted.consented = true;
  if (output.detectedLocale && !state.detectedLocale) {
    extracted.detectedLocale = output.detectedLocale;
  }
  return extracted;
}

function protectedEnglishReply(
  nextAction: OnboardingNextAction,
  outputLocale: string,
  modelReply: string,
): string {
  if (!isEnglishLocale(outputLocale)) return normalizeAssistantText(modelReply);
  if (nextAction === "ask_age") return ENGLISH_AGE_GATE_REPLY;
  if (nextAction === "stop_underage") return ENGLISH_UNDER_16_REPLY;
  if (nextAction === "ask_consent") {
    const normalized = normalizeAssistantText(modelReply);
    return hasCompleteEnglishConsentNotice(normalized) ? normalized : CONSENT_ONLY_REPLY;
  }
  if (nextAction === "complete") {
    return normalizeAssistantText(modelReply) || ENGLISH_COMPLETION_FALLBACK;
  }
  return normalizeAssistantText(modelReply);
}

export async function processOnboardingMessage(
  text: string,
  state: OnboardingState,
  context: OnboardingContext,
  generate: OnboardingGenerator = generateThreadedOnboarding,
): Promise<OnboardingResult> {
  if (context.isFirstMessage && isEnglishGreetingOnly(text, context.locale)) {
    return {
      extracted: { detectedLocale: "en" },
      nextAction: "ask_age",
      reply: ENGLISH_AGE_GATE_REPLY,
    };
  }

  const output = await generate({ text, imageUrl: context.imageUrl, state, context });
  if (!output) {
    return {
      extracted: {},
      nextAction: getOnboardingNextAction(state),
      reply: "I lost the thread for a second. Could you send that again?",
    };
  }

  const extracted = extractedState(output, state);
  const merged = mergeOnboardingState(state, extracted);
  const nextAction = getOnboardingNextAction(merged);
  const outputLocale = output.detectedLocale ?? state.detectedLocale ?? context.locale;

  // The main agent shares this thread. Retire the action-bearing snapshot as
  // soon as setup completes so the next normal turn cannot inherit ask_consent.
  if (context.userId && nextAction === "complete") {
    await persistOnboardingStateSignal(context.userId, merged, {
      ...context,
      isFirstMessage: false,
    });
  }

  return {
    extracted,
    nextAction,
    reply: protectedEnglishReply(nextAction, outputLocale, output.reply),
  };
}
