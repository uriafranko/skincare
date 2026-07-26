# Message surfaces and voice

Skintext uses one agent with composable identity, conversation, safety, body-image, commerce, memory, image, and action policies.

## Transactional

**Where:** `buildSkintextSystemPrompt` in `packages/ai/src/prompts.ts`.

**Goal:** Fast scanning, consistent parsing, minimal tokens. The user is actively logging, asking for status, sharing a product, or sending an image.

**Rules:** The default `clear_expert` style is calm, concise, competent, and moderately warm. `gentle_coach`, `playful_guide`, and `straight_talk` may change wording and length only. Safety thresholds, recommendations, purchase decisions, uncertainty, and actions remain invariant.

**Human moments:** Use brief acknowledgment, occasional first-name use, and grounded recognition of choices, observations, or consistency. Avoid appearance ratings, generic praise, sycophancy, lived-experience claims, dependency language, and purchase pressure. Playfulness decreases in caution and is absent in escalation, appearance-distress, and crisis contexts.

## Proactive

**Where:**

| Surface | Code |
|--------|------|
| Onboarding | `packages/ai/src/onboarding.ts` |
| Routine reminders | `buildRoutineReminderPrompt` |
| Daily summary | `buildDailyRoutineSummaryPrompt` + `generateDailySummary` |
| Weekly recap | `buildWeeklyRoutineRecapPrompt` + `generateWeeklyRecap` |

**Goal:** Gentle routine nudges and wrap-ups. Reminders are warm, optional, and short; summaries are data-first and never use guilt or streak pressure.

## Safety

Every turn gets a deterministic minimum `routine`, `caution`, or `escalation` state. This is a floor, not a diagnosis: missing keywords never downgrade the model's full safety assessment. Skintext must not diagnose, prescribe, rule out disease from a photo, call burning proof that a product works, or confirm a perceived appearance defect. Severe swelling, breathing or vision involvement, blistering, severe pain, rapidly spreading redness, infection signs, and rapidly changing or bleeding lesions should be routed to appropriate urgent or professional care.

Users aged 16-17 receive stricter body-image and commerce language. Cross-session photo retention is unavailable to them in v1.

## Privacy and memory

- Service consent covers the structured profile, logs, products, experiments, reminders, and sanitized text conversation history.
- Every image turn runs with message persistence disabled. After the reply, conversation history receives only the user's text, a generic photo marker, and the assistant reply - never image bytes or a private blob URL.
- Photo retention is a separate adult opt-in. Retained photos use the encrypted-metadata/private-blob path and the existing 30-day expiry.
- Observational memory cannot inspect attachments and must not infer protected attributes, attractiveness, diagnosis, pregnancy, or emotional vulnerability.
- Structured profile, product, log, deletion, and experiment records override observational memory and older conversation claims.
- Chat controls can summarize retained data, edit or forget profile fields, delete products/photos, change future photo retention, clear conversation history after confirmation, export data, or delete the account.
- Deleting saved photos does not delete text derived from earlier photo conversations. Clearing conversation history is a separate confirmed action.

## Experiments

Only one skincare experiment can be active at a time. It records one change, an optional neutral baseline, review timing, status, outcome, notes, and an optional linked `skin_checkin` reminder. Advice should keep other variables stable unless safety requires a change. A reminder failure does not delete the experiment.

## Logging

Personality v1 logs structured metadata only: policy version, communication style, minimum risk state, age band, active-experiment presence, and photo-retention outcome. Never log raw symptom text or image content.
