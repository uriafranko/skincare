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
    manageWorkingMemory: true,
    instruction:
      "Preserve useful skincare task continuity, including established routine steps, product placement, changes being tested, explicit corrections, and pending follow-ups. Keep working memory as the compact current source of conversational user state: profile details, the complete current product roster, the one active experiment, the most recent experiment outcome, and unresolved follow-ups. Operational timezone comes from turn context and must not be copied into working memory. When the user adds, corrects, stops, removes, or forgets something, update the full relevant state so the latest explicit statement wins and superseded facts are not resurrected. Keep older experiment history in observations rather than growing working memory. Do not treat conversational memory as verified routine completion or log status; exact logs come from the routine-log tools. A retained-photo reference is only an operational pointer: preserve its ID and expiry when useful, but never infer visual facts from it or copy it into working memory. Never infer or retain ethnicity, attractiveness, exact age, pregnancy, diagnoses, emotional vulnerability, or private third-party facts. Do not infer anything from attachment placeholders.",
  },
} as const;

export interface RetainedPhotoReference {
  id: string;
  expiresAt: string;
}

export function sanitizedImageUserText(
  userText: string,
  retainedPhoto?: RetainedPhotoReference,
): string {
  const marker =
    "[Photo processed for this turn; raw image content was not stored in conversation history.]";
  const retainedMarker = retainedPhoto
    ? `[Retained photo reference: ${retainedPhoto.id}; available until ${retainedPhoto.expiresAt}. The raw image remains outside conversation history.]`
    : "";
  const text = userText.trim();
  return [text, marker, retainedMarker].filter(Boolean).join("\n\n");
}
