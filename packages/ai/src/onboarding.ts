import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { isValidTimeZone, type OnboardingState } from "@skintext/shared";
import { z } from "zod";
import { toMastraModelName } from "./model-name";
import { getDefaultModelName, getDefaultProviderOptions } from "./models";
import { normalizeAssistantText } from "./text";

const extractionSchema = z.object({
  ageEligible: z
    .boolean()
    .nullable()
    .optional()
    .describe(
      "True only when the user confirms they are at least 16. False when they say they are under 16. Null when eligibility is not established.",
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
      "True only if the user explicitly agreed both to storing skincare data and to the Terms of Use, including by replying AGREE to Lily's combined request. False if refused; null if either part was not addressed.",
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
    name: "Lily Onboarding",
    model,
    defaultOptions: { providerOptions: getDefaultProviderOptions() },
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

const CONSENT_ONLY_REPLY =
  "Reply AGREE if I can save your skincare data for reminders/logs and you accept the Terms of Use: https://skintext.ai/terms. Privacy: https://skintext.ai/privacy. You can delete your data anytime.";
const CONSENT_ASK_DESCRIPTION =
  'Ask the user to reply "AGREE" if Lily may save their skincare setup data for reminders/logs and they accept the Terms of Use. Include the exact URLs https://skintext.ai/terms and https://skintext.ai/privacy, identify the second as the Privacy Policy, and say they can delete their data anytime.';
const CONSENT_ONLY_REPLY_INSTRUCTION = `${CONSENT_ASK_DESCRIPTION} Translate the surrounding text into the user's language but keep the word AGREE and both URLs unchanged. Make no other setup asks.`;

const ENGLISH_AGE_GATE_REPLY = "Hey, I'm Lily. Before we get started, are you 16 or older?";
const ENGLISH_UNDER_16_REPLY =
  "I can only help people who are 16 or older, so I can't continue setup.";

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
    (extracted.ageEligible ?? state.ageEligible) === true &&
    !!(extracted.name ?? state.name) &&
    (concerns.length > 0 || goals.length > 0) &&
    !!(extracted.skinType ?? state.skinType ?? extracted.sensitivity ?? state.sensitivity) &&
    reminderTimezoneReady
  );
}

function describeState(state: OnboardingState): string {
  const parts: string[] = [];
  if (state.ageEligible === true) parts.push("age eligibility: 16+ confirmed");
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
  if (state.consented) parts.push("data-storage and Terms consent: given");
  return parts.length > 0 ? parts.join(", ") : "nothing yet";
}

function describeMissing(state: OnboardingState): string {
  const missing: string[] = [];
  if (state.ageEligible !== true) missing.push("confirmation that the user is 16 or older");
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("main skin goals or concerns");
  if (!state.skinType && !state.sensitivity) {
    missing.push("skin type or sensitivity level (unsure is fine)");
  }
  if ((state.morningReminder || state.eveningReminder) && !state.timezoneConfirmed) {
    missing.push("city or timezone for reminders");
  }
  if (!state.consented)
    missing.push("explicit agreement to the Terms and storage of skincare data");
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

  if (state.ageEligible !== true) {
    situation = `Age eligibility must be established before collecting or asking for any other setup information.
- If this message does not establish eligibility, ask only whether the user is 16 or older. Do not ask for their exact age or birthdate.
- If the user explicitly says they are under 16, explain briefly in first person that you can only help people 16 or older and that setup cannot continue. Do not ask any other question.
- If the message establishes they are 16 or older, acknowledge it briefly and ask for only the next one or two missing setup essentials. Extract any other details they volunteered, but do not ask for more than those next essentials.
Keep this to one short bubble.`;
  } else if (ctx.isFirstMessage) {
    situation = `This is the user's FIRST message. Welcome them as Lily, their skincare routine assistant in iMessage. Introduce yourself naturally in first person, never like a product or company.

CONTENT (keep SHORT -- 2-3 short sentences, one bubble when possible):
- Lead with the payoff in plain language: you can help them build a practical routine and keep reminders/logs by text.
- First interpret the user's message and extract it. Do not ask for anything they already gave.
- If they give a first name, use it once in a natural spot.
- When they share useful setup details, add a tiny, specific positive acknowledgment only when it adds warmth or confirms an important choice. Do not make every reply start with one. Compliment their choices or clarity, not their appearance.
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

In your reply: ask only for what is still missing -- one or two asks at a time if several fields are missing. Acknowledge new information only when it adds warmth or confirms an important correction; do not make every reply start with an acknowledgment. If reminders are relevant and the reply would still stay short, ask when they would like reminders as an optional preference, not a required setup field. If you know their first name, use it only when it feels natural, not in every reply. Any concern counts as a goal/concern, so do not ask what they want to improve if they mention dryness, breakouts, acne, redness, texture, or similar concerns. If only consent is missing, ${CONSENT_ONLY_REPLY_INSTRUCTION}. Keep it short and conversational.`;
  }

  const output =
    await generate(`Your name is Lily. You are a friendly AI skincare routine assistant in iMessage. ${replyLang}
${conversationContext}
USER MESSAGE: "${text}"

CURRENT STATE: ${describeState(state)}

SITUATION: ${situation}

EXTRACTION INSTRUCTIONS:
- Extract values the user stated or confirmed in this message. Use null for anything not addressed.
- ageEligible: set true when the user explicitly confirms they are 16 or older, including an affirmative response to a previous 16+ question or a volunteered age of 16 or older. Set false when they explicitly say they are under 16, including a negative response to a previous 16+ question. Otherwise use null.
- Never infer eligibility from appearance, language, phone number, products, or concerns.
- Never request or extract an exact age or birthdate.
- Mark consented true only when the user explicitly agrees both to saving their skincare data and to the Terms of Use. A reply of AGREE to Lily's prior combined Terms-and-storage request qualifies. Agreement only to storage, or a generic affirmative without the prior combined request, does not qualify.
- skinType: use "unsure" if they say they do not know.
- sensitivity: use "unsure" if they say they do not know.
- routinePreference: infer "simple" if they ask for minimal/basic, "detailed" if they want many steps, otherwise null unless stated.
- morningReminder/eveningReminder: normalize explicit reminder times to HH:mm in 24h local time. Use null if no time is mentioned.
- Do not infer reminder times from routine labels alone. Only extract reminder times when the user provides an explicit time.
- timezone: when the user explicitly states a city or timezone, convert it to a valid IANA timezone such as America/New_York. Never infer it from their phone number, language, or country alone.
- detectedLocale: detect the BCP-47 language code from the user's latest message text.

REPLY INSTRUCTIONS:
- Write a short, casual iMessage-style reply.
- Return plain text only. Never use Markdown headings, bullets, numbered lists, blockquotes, tables, code fences, inline code, emphasis markers, or Markdown links.
- Lead with the next useful question, answer, or confirmation. Do not restate or paraphrase the user's message as a preamble.
- Do not add generic closing offers such as "Let me know if you need anything else." End when the useful reply is complete.
- Check your previous message and the current state before asking anything. Never repeat the same question or recommendation unless the user asks for it or relevant facts changed.
- Treat the user's latest message as the voice reference. Reply in the same language and follow their natural language mix if they code-switch.
- Match their formality, confidently understood regional phrasing, slang level, rhythm, directness, energy, capitalization, punctuation, and emoji use.
- Match their brevity and energy, but answer fully when consent, age eligibility, or ambiguity requires it.
- Do not introduce emoji unless the user used emoji in their latest message.
- Use slang only when you understand it and it fits naturally. Do not force slang, caricature a dialect, copy obvious typos, or mirror slurs or abusive language.
- Prefer one bubble. Use a second bubble only when the reply has two distinct thoughts.
- Avoid paragraph breaks in onboarding unless the reply is over 240 characters.
- Do NOT repeat or echo every detail back. Just move on to what's next.
- Never repeat a greeting if the user already introduced themselves.
- If reminder times are present but no user-stated timezone is confirmed, ask for their current city or timezone and do not say reminders are set.
- Be direct like a friend texting, not formal.
- Speak naturally in first person. Never refer to yourself as a product, company, "the assistant", or in the third person.
- If you introduce yourself, say "I'm Lily" or the natural equivalent in the user's language.
- Do not claim to be human or imply human lived experience.
- Make the user feel seen through one relevant detail or grounded compliment, not generic hype.
- Never use romantic, intense, dependency-building, or appearance-based flattery.
- Avoid listy setup language like "please provide", "required fields", or "the following".
- Use plain ASCII punctuation. Avoid curly quotes, curly apostrophes, and em dashes.
- Use normal contractions with straight apostrophes, like "don't" and "can't".
- Never mention internal workflows, models, databases, memory retrieval, or "the system"; describe what you are doing directly in first person.
- If the user corrects a setup detail or sounds frustrated, briefly acknowledge the issue from their perspective, use the corrected info, and avoid technical explanations.
- Do NOT wrap the reply in quotes.
- NEVER re-ask for information the user already confirmed.`);

  if (!output) {
    return { extracted: {}, reply: "Hey, something went wrong -- try again?" };
  }

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
