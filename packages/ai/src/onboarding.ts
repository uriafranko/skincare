import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { isValidTimeZone, type OnboardingState } from "@skintext/shared";
import { z } from "zod";
import { toMastraModelName } from "./model-name";
import { getDefaultModelName } from "./models";
import { normalizeAssistantText } from "./text";

const extractionSchema = z.object({
  ageBand: z
    .enum(["16_17", "18_plus"])
    .nullable()
    .optional()
    .describe(
      "The user's stated age band. 16 or 17 maps to 16_17; age 18 or older or an explicit adult statement maps to 18_plus. Never infer it.",
    ),
  ageEligible: z
    .boolean()
    .nullable()
    .optional()
    .describe(
      "False only when the user explicitly says they are under 16. True when their explicit age is 16 or older. Null when age is not established.",
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
  concerns: z.array(z.string()).nullable().describe("Skin concerns, e.g. dryness, acne, redness."),
  goals: z.array(z.string()).nullable().describe("Skincare goals, e.g. simpler routine, glow."),
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
    .describe("Preferred morning reminder time in HH:mm 24h local time, if mentioned."),
  eveningReminder: z
    .string()
    .nullable()
    .describe("Preferred evening reminder time in HH:mm 24h local time, if mentioned."),
  timezone: z
    .string()
    .nullable()
    .describe(
      "Valid IANA timezone derived only from a city or timezone the user explicitly states, e.g. America/New_York. Null otherwise.",
    ),
  consented: z
    .boolean()
    .nullable()
    .describe(
      "True if user agreed to store skincare data, false if refused, null if not addressed.",
    ),
  detectedLocale: z
    .string()
    .nullable()
    .describe("BCP-47 language code of the user's message, e.g. 'sv', 'en', 'fr'."),
  reply: z.string().describe("Your reply message to the user."),
});

type OnboardingExtraction = z.infer<typeof extractionSchema>;
export type OnboardingGenerator = (prompt: string) => Promise<OnboardingExtraction>;

function createGenerator(model: MastraModelConfig): OnboardingGenerator {
  const agent = new Agent({
    id: "skintext-onboarding",
    name: "Skintext Onboarding",
    model,
    instructions: "Extract onboarding details and write the next concise iMessage reply.",
  });

  return async (prompt) => {
    const result = await agent.generate(prompt, {
      structuredOutput: { schema: extractionSchema },
    });
    return result.object;
  };
}

let defaultOnboardingGenerator: OnboardingGenerator | undefined;

export function createOnboardingGenerator(modelName?: string): OnboardingGenerator {
  if (modelName) return createGenerator(toMastraModelName(modelName));

  return async (prompt) => {
    if (!defaultOnboardingGenerator) {
      defaultOnboardingGenerator = createGenerator(getDefaultModelName());
    }
    return defaultOnboardingGenerator(prompt);
  };
}

const generateDefaultOnboarding = createOnboardingGenerator();

const CONSENT_ONLY_REPLY = "OK if I save this so reminders/logs work? You can delete it anytime.";
const CONSENT_ASK_DESCRIPTION =
  "Ask whether it is OK to save setup details so reminders/logs work, and say they can delete it anytime.";
const CONSENT_ONLY_REPLY_INSTRUCTION = `${CONSENT_ASK_DESCRIPTION} Ask this in the user's language, with no other setup asks.`;

const ENGLISH_AGE_GATE_REPLY = "Hey, I'm Skintext. Before we set things up, are you 16-17 or 18+?";
const ENGLISH_UNDER_16_REPLY = "Skintext is for people 16 or older, so I can't continue setup.";

function formatList(values?: readonly string[]): string | null {
  return values?.length ? values.join(", ") : null;
}

function isEnglishGreetingOnly(text: string, locale: string): boolean {
  if (locale && !locale.toLowerCase().startsWith("en")) return false;
  return /^(?:hi|hey|hello|yo)[\s!.]*$/i.test(text.trim());
}

function isEnglishLocale(locale?: string | null): boolean {
  return !locale || locale.toLowerCase().startsWith("en");
}

function hasSetupBasics(state: OnboardingState, extracted: Partial<OnboardingState>): boolean {
  const concerns = [...(state.concerns ?? []), ...(extracted.concerns ?? [])];
  const goals = [...(state.goals ?? []), ...(extracted.goals ?? [])];
  const hasReminder =
    !!(extracted.morningReminder ?? state.morningReminder) ||
    !!(extracted.eveningReminder ?? state.eveningReminder);
  const reminderTimezoneReady =
    !hasReminder || !!(extracted.timezoneConfirmed ?? state.timezoneConfirmed);
  return (
    !!(extracted.ageBand ?? state.ageBand) &&
    !!(extracted.name ?? state.name) &&
    (concerns.length > 0 || goals.length > 0) &&
    !!(extracted.skinType ?? state.skinType ?? extracted.sensitivity ?? state.sensitivity) &&
    reminderTimezoneReady
  );
}

function describeState(state: OnboardingState): string {
  const parts: string[] = [];
  if (state.ageBand) parts.push(`age band: ${state.ageBand}`);
  if (state.name) parts.push(`name: ${state.name}`);
  if (state.skinType) parts.push(`skin type: ${state.skinType}`);
  if (state.sensitivity) parts.push(`sensitivity: ${state.sensitivity}`);
  if (formatList(state.concerns)) parts.push(`concerns: ${formatList(state.concerns)}`);
  if (formatList(state.goals)) parts.push(`goals: ${formatList(state.goals)}`);
  if (formatList(state.allergies))
    parts.push(`allergies/sensitivities: ${formatList(state.allergies)}`);
  if (formatList(state.currentProducts)) {
    parts.push(`current products: ${formatList(state.currentProducts)}`);
  }
  if (state.routinePreference) parts.push(`routine preference: ${state.routinePreference}`);
  if (state.morningReminder) parts.push(`morning reminder: ${state.morningReminder}`);
  if (state.eveningReminder) parts.push(`evening reminder: ${state.eveningReminder}`);
  if (state.timezoneConfirmed && state.timezone) {
    parts.push(`confirmed timezone: ${state.timezone}`);
  }
  if (state.consented) parts.push("consent: given");
  return parts.length > 0 ? parts.join(", ") : "nothing yet";
}

function describeMissing(state: OnboardingState): string {
  const missing: string[] = [];
  if (!state.ageBand) missing.push("age band (16-17 or 18+)");
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("main skin goals or concerns");
  if (!state.skinType && !state.sensitivity) {
    missing.push("skin type or sensitivity level (unsure is fine)");
  }
  if ((state.morningReminder || state.eveningReminder) && !state.timezoneConfirmed) {
    missing.push("city or timezone for reminders");
  }
  if (!state.consented) missing.push("consent to store skincare data");
  return missing.join(", ");
}

export interface OnboardingContext {
  isFirstMessage: boolean;
  timezone: string;
  locale: string;
  complete?: boolean;
}

export interface OnboardingResult {
  extracted: Partial<OnboardingState>;
  reply: string;
}

export async function processOnboardingMessage(
  text: string,
  state: OnboardingState,
  ctx: OnboardingContext,
  generate: OnboardingGenerator = generateDefaultOnboarding,
): Promise<OnboardingResult> {
  if (ctx.isFirstMessage && isEnglishGreetingOnly(text, ctx.locale)) {
    return {
      extracted: { detectedLocale: "en" },
      reply: ENGLISH_AGE_GATE_REPLY,
    };
  }

  const replyLang = state.detectedLocale
    ? `Reply in ${state.detectedLocale} (the user's language).`
    : "Reply in the same language the user writes in. Detect their language from the message.";

  const conversationContext = state.lastBotReply
    ? `\nYOUR PREVIOUS MESSAGE TO THE USER: "${state.lastBotReply}"\n(The user is responding to this message. Interpret their reply in this context.)\n`
    : "";

  let situation: string;

  if (!state.ageBand) {
    situation = `Age eligibility must be established before collecting or asking for any other setup information.
- If this message does not establish age, ask only whether the user is 16-17 or 18+. Do not ask for their exact birthdate.
- If the user explicitly says they are under 16, explain briefly that Skintext is for people 16 or older and that setup cannot continue. Do not ask any other question.
- If the message establishes they are 16-17 or 18+, acknowledge it briefly and ask for only the next one or two missing setup essentials. Extract any other details they volunteered, but do not ask for more than those next essentials.
Keep this to one short bubble.`;
  } else if (ctx.isFirstMessage) {
    situation = `This is the user's FIRST message. Welcome them as Skintext, a skincare routine assistant in iMessage.

CONTENT (keep SHORT -- 2-3 short sentences, one bubble when possible):
- Lead with the payoff in plain language: Skintext helps build a practical routine and keeps reminders/logs by text.
- First interpret the user's message and extract it. Do not ask for anything they already gave.
- If they give a first name, use it once in a natural spot.
- When they share useful setup details, add one tiny, specific positive acknowledgment like "Nice, that's a clear starting point" or "Good call keeping it simple." Compliment their choices or clarity, not their appearance.
- Any skin concern counts as the goal/concern. Dry cheeks, breakouts, acne, redness, texture, irritation, and similar phrases are enough.
- Current products and reminder times are useful but optional. Do not block consent or completion on them.
- Reminders are opt-in. Ask when they would like reminders only as an optional preference, and never imply reminders will be created by default.
- If this message contains name + any skin goal/concern + skin type/sensitivity and only consent is missing, ${CONSENT_ONLY_REPLY_INSTRUCTION}
- If they only sent a greeting, ask for the setup essentials in one natural sentence: name, main skin goal/concern, skin type or sensitivity if known, anything they avoid, current products, and optional reminder times if they want reminders.
- Say "unsure" is fine.
- Include storage consent as part of the first ask in the user's language. ${CONSENT_ASK_DESCRIPTION}
- Reminder times are optional and opt-in. Save them if the user gives them, but do not make them sound required and do not invent defaults.
- If the user gives reminder times but has not explicitly stated a city or timezone, ask for their current city or timezone before saying setup or reminders are complete. Do not rely on a phone-number location guess.
- Do not mention photos or product-label photos in the first setup ask unless the user sent or mentioned a photo.
- End with a localized low-friction CTA that lets them know they can send the details however is easiest.
- Do not add that low-friction CTA to a consent-only reply.

TONE: warm, direct, iMessage-native. No bullets, no form language, no sales copy.`;
  } else if (ctx.complete) {
    situation = `The user is fully set up. Reply with one compact confirmation in the user's language.
Start with the natural equivalent of "All set" and use their first name if known.
Add one brief, grounded compliment about their setup choices or clarity, not their appearance.
Then include this next step in natural wording: they can text the localized equivalent of "done" after their routine, or send a skin/product photo anytime they want help placing something. Do not use the English word "done" unless replying in English.
Keep it to 1-2 short sentences.`;
  } else {
    situation = `This is a follow-up message. The user already provided some info.
Already collected: ${describeState(state)}.
Still missing: ${describeMissing(state)}.

In your reply: briefly acknowledge any new info they just provided, then ask only for what is still missing -- one or two asks at a time if several fields are missing. If reminders are relevant and the reply would still stay short, ask when they would like reminders as an optional preference, not a required setup field. If you know their first name, use it only when it feels natural, not in every reply. Add one small, specific positive acknowledgment when they share useful skincare context, like "Good call avoiding fragrance" or "Nice, that helps." Any concern counts as a goal/concern, so do not ask what they want to improve if they mention dryness, breakouts, acne, redness, texture, or similar concerns. If only consent is missing, ${CONSENT_ONLY_REPLY_INSTRUCTION}. Keep it short and conversational.`;
  }

  const output =
    await generate(`You are Skintext, a friendly skincare routine assistant in iMessage. ${replyLang}
${conversationContext}
USER MESSAGE: "${text}"

CURRENT STATE: ${describeState(state)}

SITUATION: ${situation}

EXTRACTION INSTRUCTIONS:
- Extract values the user stated or confirmed in this message. Use null for anything not addressed.
- ageBand: map an explicitly stated age of 16 or 17 to "16_17"; map age 18 or older, or an explicit statement that they are an adult, to "18_plus". Never infer age from appearance, language, phone number, products, or concerns.
- ageEligible: set false only when the user explicitly establishes that they are under 16; set true for an explicit age of 16 or older; otherwise null.
- Never request or extract an exact birthdate.
- If your previous message asked the user to confirm something and the user replies affirmatively (yes, yeah, yep, ja, japp, oui, si, ok, sure, כן, etc.), mark consented as true only when the confirmation is about data storage.
- skinType: use "unsure" if they say they do not know.
- sensitivity: use "unsure" if they say they do not know.
- routinePreference: infer "simple" if they ask for minimal/basic, "detailed" if they want many steps, otherwise null unless stated.
- morningReminder/eveningReminder: normalize explicit reminder times to HH:mm in 24h local time. Use null if no time is mentioned.
- Do not infer reminder times from routine labels alone. Only extract reminder times when the user provides an explicit time.
- timezone: when the user explicitly states a city or timezone, convert it to a valid IANA timezone such as America/New_York. Never infer it from their phone number, language, or country alone.
- detectedLocale: detect the BCP-47 language code from the user's latest message text.

REPLY INSTRUCTIONS:
- Write a short, casual iMessage-style reply.
- Prefer one bubble. Use a second bubble only when the reply has two distinct thoughts.
- Avoid paragraph breaks in onboarding unless the reply is over 240 characters.
- Do NOT repeat or echo every detail back. Just move on to what's next.
- Never repeat a greeting if the user already introduced themselves.
- If reminder times are present but no user-stated timezone is confirmed, ask for their current city or timezone and do not say reminders are set.
- Be direct like a friend texting, not formal.
- Make the user feel seen through one relevant detail or grounded compliment, not generic hype.
- Never use romantic, intense, dependency-building, or appearance-based flattery.
- Avoid listy setup language like "please provide", "required fields", or "the following".
- Use plain ASCII punctuation. Avoid curly quotes, curly apostrophes, and em dashes.
- Use normal contractions with straight apostrophes, like "don't" and "can't".
- Never mention internal workflows, models, databases, memory retrieval, or "the system"; describe setup as Skintext doing it directly.
- If the user corrects a setup detail or sounds frustrated, briefly acknowledge the issue from their perspective, use the corrected info, and avoid technical explanations.
- Do NOT wrap the reply in quotes.
- NEVER re-ask for information the user already confirmed.`);

  if (!output) {
    return { extracted: {}, reply: "Hey, something went wrong -- try again?" };
  }

  const extracted: Partial<OnboardingState> = {};
  if (output.ageBand) {
    extracted.ageBand = output.ageBand;
    extracted.ageEligible = true;
  } else if (output.ageEligible === false) {
    extracted.ageEligible = false;
  }
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

  const outputLocale = output.detectedLocale ?? state.detectedLocale ?? ctx.locale;
  const shouldAskConsentOnly =
    !state.consented && !extracted.consented && hasSetupBasics(state, extracted);
  if (extracted.ageEligible === false && isEnglishLocale(outputLocale)) {
    return { extracted, reply: ENGLISH_UNDER_16_REPLY };
  }
  const reply =
    shouldAskConsentOnly && isEnglishLocale(outputLocale)
      ? CONSENT_ONLY_REPLY
      : normalizeAssistantText(output.reply);

  return { extracted, reply };
}
