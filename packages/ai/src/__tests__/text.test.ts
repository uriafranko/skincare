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
});
