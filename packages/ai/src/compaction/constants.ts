export const DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;
export const DEFAULT_COMPACTION_RESERVE_TOKENS = 20_000;
export const RESCUE_COMPACTION_RESERVE_TOKENS = 12_000;
export const DEFAULT_KEEP_RECENT_TOKENS = 20_000;
export const DEFAULT_COMPACTION_MODEL = "openai/gpt-5.4-nano";

export const SUMMARY_MARKER = "[Skintext conversation summary]";
export const ESTIMATED_IMAGE_TOKENS = 1_200;
export const INTERNAL_METADATA_KEY = "_skintext";

export const SUMMARY_SYSTEM_PROMPT = `You summarize Skintext conversation history for another Skintext assistant.
Do not answer the user. Do not continue the conversation.
Only produce a concise context summary that preserves facts needed for future replies.`;

export const SUMMARY_PROMPT = `Create a compact Skintext conversation summary using this exact format:

## User Profile Context
- [Durable user facts, preferences, sensitivities, allergies, goals, products, or "(none)"]

## Recent Progress
- [Important skincare advice, routine changes, logged actions, reminders, or "(none)"]

## Open Threads
- [Questions, pending follow-ups, unresolved tasks, or "(none)"]

## Critical Details
- [Exact product names, dates, reactions, constraints, or "(none)"]

Keep it concise. Preserve exact names, dates, allergies, and safety-relevant details.`;
