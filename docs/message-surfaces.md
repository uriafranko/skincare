# Message surfaces and voice

Skintext uses two intentional voices. Keeping this split avoids blurring active routine logging with retention and setup messages.

## Transactional

**Where:** `buildSkintextSystemPrompt` in `packages/ai/src/prompts.ts`.

**Goal:** Fast scanning, consistent parsing, minimal tokens. The user is actively logging, asking for status, sharing a product, or sending an image.

**Rules:** Strict blocks for image analysis, routine proposals, post-log confirmation, and daily status. Recommendations must stay practical and non-diagnostic.

**Human moments:** Outside exact routine/status blocks, Skintext can sound more like a natural text conversation: brief acknowledgment, direct recovery from corrections, no internal tool/model/system language, and saved context used without explaining memory mechanics.

## Proactive

**Where:**

| Surface | Code |
|--------|------|
| Onboarding | `packages/ai/src/onboarding.ts` |
| Routine reminders | `buildRoutineReminderPrompt` |
| Daily summary | `buildDailyRoutineSummaryPrompt` + `generateDailySummary` |
| Weekly recap | `buildWeeklyRoutineRecapPrompt` + `generateWeeklyRecap` |

**Goal:** Gentle routine nudges and wrap-ups. Reminders are warm and short; summaries are data-first.

## Safety

Skintext may suggest conservative OTC-style product categories and routine changes, but it must not diagnose, prescribe, or claim certainty from images. Severe, persistent, eye-area, infected-looking, painful, or rapidly changing symptoms should be routed to professional care.
