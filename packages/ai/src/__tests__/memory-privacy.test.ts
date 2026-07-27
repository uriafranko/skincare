import { describe, expect, test } from "bun:test";
import { SKINTEXT_WORKING_MEMORY_OPTIONS } from "../memory";
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

  test("adds only an operational pointer when the photo was retained", () => {
    const text = sanitizedImageUserText("Compare this later", {
      id: "img_saved",
      expiresAt: "2026-08-26T12:00:00.000Z",
    });
    expect(text).toContain("Retained photo reference: img_saved");
    expect(text).toContain("available until 2026-08-26T12:00:00.000Z");
    expect(text).not.toContain("user-images/");
    expect(text).not.toContain("data:image");
  });

  test("does not add a retained-photo pointer when storage did not succeed", () => {
    expect(sanitizedImageUserText("Not saved")).not.toContain("Retained photo reference");
  });
});

describe("conversation continuity", () => {
  test("delivers resource-scoped working memory as a state signal", () => {
    expect(SKINTEXT_WORKING_MEMORY_OPTIONS.scope).toBe("resource");
    expect(SKINTEXT_WORKING_MEMORY_OPTIONS.useStateSignals).toBe(true);
  });

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
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.instruction).toContain(
      "retained-photo reference is only an operational pointer",
    );
  });

  test("lets observation promote current state into working memory", () => {
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.manageWorkingMemory).toBe(true);
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.bufferTokens).toBe(false);
    expect(SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS.observation.instruction).toContain(
      "latest explicit statement wins",
    );
  });
});
