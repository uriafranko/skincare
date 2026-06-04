import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { OnboardingState } from "@skintext/shared";
import { generateText, Output } from "ai";
import { z } from "zod";

const extractionSchema = z.object({
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

function formatList(values?: string[]): string | null {
  return values?.length ? values.join(", ") : null;
}

function describeState(state: OnboardingState): string {
  const parts: string[] = [];
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
  if (state.consented) parts.push("consent: given");
  return parts.length > 0 ? parts.join(", ") : "nothing yet";
}

function describeMissing(state: OnboardingState): string {
  const missing: string[] = [];
  if (!state.name) missing.push("name");
  if (!state.concerns?.length && !state.goals?.length) missing.push("main skin goals or concerns");
  if (!state.skinType && !state.sensitivity) {
    missing.push("skin type or sensitivity level (unsure is fine)");
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
  model?: LanguageModelV3,
): Promise<OnboardingResult> {
  const resolvedModel = model ?? (await import("./models")).createDefaultGatewayModel();
  const replyLang = state.detectedLocale
    ? `Reply in ${state.detectedLocale} (the user's language).`
    : "Reply in the same language the user writes in. Detect their language from the message.";

  const conversationContext = state.lastBotReply
    ? `\nYOUR PREVIOUS MESSAGE TO THE USER: "${state.lastBotReply}"\n(The user is responding to this message. Interpret their reply in this context.)\n`
    : "";

  let situation: string;

  if (ctx.isFirstMessage) {
    situation = `This is the user's FIRST message. Welcome them as Skintext, a skincare routine assistant in iMessage.

CONTENT (keep SHORT -- about one phone screen, 3-6 short sentences OR two bubbles max):
- Lead with the payoff: Skintext helps build and track a practical skincare routine by text.
- Ask for: name, main skin goals/concerns, skin type if known, sensitivity/allergies, current products if any, and preferred AM/PM reminder times.
- Say "unsure" is fine for skin type or sensitivity.
- Mention they can send skin photos or product-label photos for routine help, but you cannot diagnose from images.
- Storage: we save what they share so routine reminders/logs work; they can delete anytime.
- End with a clear CTA: they can send everything in one message or a few messages.

TONE: friendly, iMessage-native, not a bulleted essay.`;
  } else if (ctx.complete) {
    situation = `The user is fully set up. Reply with ONLY:
"✅ All set.
Text done after your routine, or send a skin/product photo whenever you want help placing something."
No extra commentary.`;
  } else {
    situation = `This is a follow-up message. The user already provided some info.
Already collected: ${describeState(state)}.
Still missing: ${describeMissing(state)}.

In your reply: briefly acknowledge any new info they just provided, then ask only for what is still missing -- one or two asks at a time if several fields are missing. If only consent is missing, ask for their OK to store skincare data and mention they can delete anytime. Keep it short and conversational.`;
  }

  const { output } = await generateText({
    model: resolvedModel,
    output: Output.object({ schema: extractionSchema }),
    prompt: `You are Skintext, a friendly skincare routine assistant in iMessage. ${replyLang}
${conversationContext}
USER MESSAGE: "${text}"

CURRENT STATE: ${describeState(state)}

SITUATION: ${situation}

EXTRACTION INSTRUCTIONS:
- Extract values the user stated or confirmed in this message. Use null for anything not addressed.
- If your previous message asked the user to confirm something and the user replies affirmatively (yes, yeah, yep, ja, japp, oui, si, ok, sure, etc.), mark consented as true only when the confirmation is about data storage.
- skinType: use "unsure" if they say they do not know.
- sensitivity: use "unsure" if they say they do not know.
- routinePreference: infer "simple" if they ask for minimal/basic, "detailed" if they want many steps, otherwise null unless stated.
- morningReminder/eveningReminder: normalize explicit reminder times to HH:mm in 24h local time. Use null if no time is mentioned.
- detectedLocale: detect the BCP-47 language code from the user's latest message text.

REPLY INSTRUCTIONS:
- Write a short, casual iMessage-style reply.
- Do NOT repeat or echo every detail back. Just move on to what's next.
- Never repeat a greeting if the user already introduced themselves.
- Be direct like a friend texting, not formal.
- Never mention internal workflows, models, databases, memory retrieval, or "the system"; describe setup as Skintext doing it directly.
- If the user corrects a setup detail or sounds frustrated, briefly acknowledge the issue from their perspective, use the corrected info, and avoid technical explanations.
- Do NOT wrap the reply in quotes.
- NEVER re-ask for information the user already confirmed.`,
  });

  if (!output) {
    return { extracted: {}, reply: "Hey, something went wrong -- try again?" };
  }

  const extracted: Partial<OnboardingState> = {};
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
  if (output.consented === true) extracted.consented = true;
  if (output.detectedLocale && !state.detectedLocale) {
    extracted.detectedLocale = output.detectedLocale;
  }

  return { extracted, reply: output.reply };
}
