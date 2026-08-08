# Message surfaces and voice

Lily uses separate onboarding and main agent prompts on the same Mastra memory and user thread. Both compose the same identity, conversation, safety, body-image, and response policies.

## Transactional

**Where:** the static `buildSkintextSystemPrompt` in `packages/ai/src/prompts/main.ts`.

**Goal:** Fast scanning, consistent parsing, minimal tokens. The user is actively logging, asking for status, sharing a product, or sending an image.

**Rules:** The latest user message is the primary voice reference. Match its language or natural code-switching, formality, confidently understood regional phrasing, slang level, rhythm, directness, energy, capitalization, punctuation, and emoji use. Reuse slang only when its meaning and fit are clear; do not force slang, caricature dialect, copy obvious typos, or mirror slurs or abuse. The default `clear_expert` style is calm, concise, competent, and moderately warm. `gentle_coach`, `playful_guide`, and `straight_talk` fine-tune expression only. Safety thresholds, recommendations, purchase decisions, uncertainty, and actions remain invariant.

Ordinary interactions never require command syntax. Users can say that they finished, skipped, want more time, changed a product, or want a reminder in their own words. Lily confirms verified actions conversationally and never exposes tool names, status labels, record IDs, or mechanical action receipts.

Product questions use a natural product-to-routine flow: lead with the practical answer, place the product, give a conservative starting cadence and one relevant watch-out, then stop. For several products, Lily may reason internally about what to keep, move, pause, or leave optional, but expresses the result as warm prose rather than a labeled decision table. A photographed product joins the current roster or adopted plan only after the user confirms it.

**Human moments:** Use brief acknowledgment, occasional first-name use, and grounded recognition of choices, observations, or consistency. Avoid appearance ratings, generic praise, sycophancy, lived-experience claims, dependency language, and purchase pressure. Playfulness decreases in caution and is absent in escalation, appearance-distress, and crisis contexts.

## Proactive

**Where:**

| Surface | Code |
|--------|------|
| Onboarding prompt | `packages/ai/src/prompts/onboarding.ts` |
| Onboarding runtime | `packages/ai/src/onboarding.ts` |
| Routine reminders | `buildRoutineReminderEvent` in `apps/api/workflows/reminder-events.ts` -> `sendReminderToAgent` in `apps/api/workflows/steps/reminder-steps.ts` |
| Daily summary | `buildDailySummaryReminder` -> `sendReminderToAgent` in `apps/api/workflows/steps/reminder-steps.ts` |
| Weekly recap | `buildWeeklyRecapReminder` -> `sendReminderToAgent` in `apps/api/workflows/steps/reminder-steps.ts` |

**Goal:** Gentle routine nudges and wrap-ups. Reminders are warm, optional, and short; summaries are data-first and never use guilt or streak pressure.

Routine reminders invite a normal reply rather than listing keywords. Daily and weekly reflections are mutually exclusive on Sundays, and separate adherence-milestone messages are not sent. A reflection offers one useful observation or one gentle decision instead of reciting a scorecard.

Every proactive surface sends an internal prompt through the same main agent and persistent per-user Mastra thread used for inbound messages. Recent messages and observational memory provide conversational continuity without injecting routine logs into the static system prompt. When exact routine facts matter, the agent uses its verified today/weekly routine-log tools; scheduled prompts already carry the event-specific facts they need.

## Runtime context

The main system prompt contains only stable identity, voice, safety, privacy, memory, image, action, commerce, and scheduled-event rules. Slow server-verified facts - locale, local date, timezone, service consent, photo-retention consent, and adherence streak - are sent as one deduplicated `account-state` snapshot on the same Mastra thread. Turn-only routing facts - minimum risk state, scheduled-event status, and one-time offer decisions - are attributes on the current user message. Image presence is represented only by the actual attached file, never by a duplicated `imageAttached` flag.

## Safety

Every turn gets a deterministic minimum `routine`, `caution`, or `escalation` state. This is a floor, not a diagnosis: missing keywords never downgrade the model's full safety assessment. Lily must not diagnose, prescribe, rule out disease from a photo, call burning proof that a product works, or confirm a perceived appearance defect. Severe swelling, breathing or vision involvement, blistering, severe pain, rapidly spreading redness, infection signs, and rapidly changing or bleeding lesions should be routed to appropriate urgent or professional care.

Onboarding validates only that the user is 16 or older; Lily does not divide eligible users into age bands.

## Privacy and memory

- Service consent covers working memory, logs, reminders, and sanitized text conversation history.
- Every image turn runs with message persistence disabled. After the reply, conversation history receives only the user's text, a generic photo marker, and the assistant reply - never image bytes or a private blob URL.
- After age eligibility is established, a product photo sent during onboarding may be inspected transiently so Lily can give useful placement guidance before setup is complete. That image turn is stateless and its pixels are not written to onboarding history.
- Photo retention is a separate adult opt-in. Retained photos use the metadata/private-blob path and the existing 30-day expiry.
- Observational memory cannot inspect attachments and must not infer protected attributes, attractiveness, diagnosis, pregnancy, or emotional vulnerability.
- Working memory is the current source for profile details, products, communication style, experiments, and follow-ups. Newer conversation claims override stale working memory until observation reconciles it.
- Chat controls can summarize retained data, correct or forget conversational details, delete photos, change future photo retention, export data, or delete the account.
- Deleting saved photos does not delete text derived from earlier photo conversations. Account deletion removes both.

## Experiments

Only one skincare experiment can be active in working memory at a time. It records one change, an optional neutral baseline, and review timing; the latest outcome can remain compactly available while older experiment history moves into observations. An optional `skin_checkin` reminder is a separate operational record. Advice should keep other variables stable unless safety requires a change.

## Logging

Personality v1 logs structured metadata only: policy version, minimum risk state, working-memory personalization source, and photo-retention outcome. Never log raw symptom text or image content.
