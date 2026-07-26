import { describe, expect, test } from "bun:test";
import { SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS, sanitizedImageUserText } from "../memory-policy";

describe("image conversation privacy", () => {
  test("disables attachment observation", () => {
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.observeAttachments).toBe(false);
  });

  test("builds a text-only generic marker for image turns", () => {
    const text = sanitizedImageUserText("Where does this fit?");
    expect(text).toContain("Photo processed for this turn");
    expect(text).toContain("Where does this fit?");
    expect(text).not.toContain("data:image");
    expect(text).not.toContain("private/");
    expect(text).not.toContain('"type":"image"');
  });
});

describe("conversation continuity", () => {
  test("keeps long-term continuity in observational memory with raw-history retrieval", () => {
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.temporalMarkers).toBe(true);
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.retrieval).toBe(true);
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.instruction).toContain(
      "Preserve useful skincare task continuity",
    );
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.instruction).toContain(
      "established routine steps",
    );
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.instruction).toContain(
      "exact logs come from the routine-log tools",
    );
  });
});
