export const SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS = {
  temporalMarkers: true,
  retrieval: true,
  reflection: {
    observationTokens: 50_000,
  },
  shareTokenBudget: true,
  observation: {
    messageTokens: 80_000,
    bufferTokens: false,
    observeAttachments: false,
    instruction:
      "Preserve useful skincare task continuity, but never infer or retain ethnicity, attractiveness, exact age, pregnancy, diagnoses, emotional vulnerability, or private third-party facts. Treat explicit corrections and deletions as authoritative. Do not infer anything from attachment placeholders.",
  },
} as const;

export function sanitizedImageUserText(userText: string): string {
  const marker =
    "[Photo processed for this turn; raw image content was not stored in conversation history.]";
  const text = userText.trim();
  return text ? `${text}\n\n${marker}` : marker;
}
