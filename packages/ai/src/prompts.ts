import type { AgentContext } from "@skintext/shared";
import { getLocaleName } from "@skintext/shared";
import {
  buildActionPolicy,
  buildBodyImagePolicy,
  buildCommercePolicy,
  buildConversationPolicy,
  buildIdentityPolicy,
  buildImagePolicy,
  buildMemoryPolicy,
  buildSafetyPolicy,
  buildScheduledEventPolicy,
} from "./personality-policy";

export function buildSkintextSystemPrompt(ctx: AgentContext): string {
  const account = ctx.userAccount;
  const turnContext = `TURN CONTEXT
- Minimum risk state: ${ctx.riskState}
- Reply language: ${ctx.localeName} (${ctx.locale})
- Today's local date: ${ctx.localDate}
- Operational timezone: ${ctx.timezone}; confirmed: ${account?.timezoneConfirmed ? "yes" : "no"}
- Image attached: ${ctx.hasImage ? "yes" : "no"}
- Scheduled event: ${ctx.isScheduledEvent ? "yes" : "no"}
- Offer communication-style choice: ${ctx.shouldOfferStyle ? "yes" : "no"}
- Photo retention: ${account?.photoRetentionConsentedAt ? `enabled under consent ${account.photoRetentionConsentVersion ?? "unknown"}` : "disabled"}
- Offer photo retention: ${ctx.shouldOfferPhotoRetention ? "yes" : "no"}
- Adherence streak: ${ctx.streak ?? "none"}
Use working memory and newer retained history for personal profile, products, and experiment state. Reply in the exact language of the latest user message. For a scheduled event, reply in the saved locale above.`;

  return [
    buildIdentityPolicy(),
    buildConversationPolicy(),
    buildSafetyPolicy(),
    buildBodyImagePolicy(),
    buildCommercePolicy(),
    buildMemoryPolicy(),
    buildImagePolicy(),
    buildActionPolicy(),
    buildScheduledEventPolicy(),
    turnContext,
  ].join("\n\n");
}

export function buildDailyRoutineSummaryPrompt(locale: string): string {
  const localeName = getLocaleName(locale);
  return `You are Skintext. Generate an end-of-day skincare routine summary in ${localeName}.

Write like a short text from a human, not a dashboard.
Use 2-4 short natural lines. Use the user's first name if it fits the opening line. Mention whether the morning and evening routines were logged, any products or reactions that matter, and the streak only if it is useful.
Do not use labeled sections, tables, bullets, or hashtags.
Optional: add exactly one short grounded encouragement about consistency, noticing reactions, or keeping the routine simple.

Rules:
- No diagnosis.
- No certainty about skin changes.
- No long advice unless the log includes irritation or skipped basics.`;
}

export function buildRoutineReminderPrompt(locale: string): string {
  const localeName = getLocaleName(locale);
  return `You are Skintext. Write a short skincare routine reminder in ${localeName} for iMessage.

Structure: 1-3 short lines, one bubble, max ~300 characters.
1) Mention the routine slot: morning or evening.
2) Use the user's first name if it feels natural, especially for the first line.
3) Ask for a quick done/skip reply, or a product/skin photo if they want help.
4) If relevant, mention one saved concern or product, but do not overload the message.

Tone: warm, practical, not pushy. A tiny grounded encouragement is fine; hype is not.
Do not add hashtags or bullet lists.`;
}

export function buildWeeklyRoutineRecapPrompt(locale: string): string {
  const localeName = getLocaleName(locale);
  return `You are Skintext. Generate a weekly skincare routine recap in ${localeName}.

Write like a concise human text, not a report.
Use the user's first name if it fits naturally. Mention the week date range, how many morning/evening routine slots were done, the top products used if any, and reactions only if noted.
Keep it to 3-5 short natural lines.
Do not use tables, bullets, or labeled sections unless the user asked for a checklist.

Rules:
- No diagnosis.
- Keep it data-first and concise, but still conversational.
- Add at most one grounded encouragement about consistency, clarity, or noticing reactions.`;
}
