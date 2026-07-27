import { describe, expect, test } from "bun:test";
import { normalizeAssistantText } from "../text";

describe("normalizeAssistantText", () => {
  test("normalizes smart punctuation and repeated blank lines", () => {
    expect(
      normalizeAssistantText(
        " \u201cCleanser\u201d \u2014 it\u2019s useful\u2026\r\n\r\n\r\nNext line. ",
      ),
    ).toBe('"Cleanser" - it\'s useful...\n\nNext line.');
  });

  test("removes Markdown while preserving readable plain text", () => {
    expect(
      normalizeAssistantText(`# Tonight

1. **Cleanse** gently
2. Use [your moisturizer](https://example.com/moisturizer)

> Skip \`retinol\`.`),
    ).toBe(
      "Tonight\n\nCleanse gently\nUse your moisturizer (https://example.com/moisturizer)\n\nSkip retinol.",
    );
  });

  test("turns Markdown table rows into plain text lines", () => {
    expect(
      normalizeAssistantText(`| Time | Step |
| --- | --- |
| AM | Sunscreen |`),
    ).toBe("Time - Step\nAM - Sunscreen");
  });
});
