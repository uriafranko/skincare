import { describe, expect, test } from "bun:test";
import { sendReplyBubbles, splitReplyIntoBubbles } from "../replies";

describe("reply bubble splitting", () => {
  test("keeps short replies as one bubble", () => {
    expect(splitReplyIntoBubbles("Done - I logged your evening routine.")).toEqual([
      "Done - I logged your evening routine.",
    ]);
  });

  test("replaces smart punctuation before delivery", () => {
    expect(splitReplyIntoBubbles("\u201cCleanser\u201d \u2014 it\u2019s useful.")).toEqual([
      '"Cleanser" - it\'s useful.',
    ]);
  });

  test("strips Markdown before iMessage delivery", () => {
    expect(splitReplyIntoBubbles("# Tonight\n- **Cleanse** gently\n- Apply `moisturizer`")).toEqual(
      ["Tonight\nCleanse gently\nApply moisturizer"],
    );
  });

  test("preserves the agent's intentional response shape", () => {
    const text =
      "Start with the cleanser tonight. Skip the exfoliant for two days. Add moisturizer while the redness settles.";

    expect(splitReplyIntoBubbles(text)).toEqual([text]);
  });

  test("hard-splits oversized text when no natural boundary exists", () => {
    const text = "x".repeat(95);
    const chunks = splitReplyIntoBubbles(text, {
      hardMaxChars: 40,
    });

    expect(chunks.every((chunk) => chunk.length <= 40)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  test("does not split emoji grapheme clusters at a hard boundary", () => {
    const text = "a👩‍🔬b";
    const chunks = splitReplyIntoBubbles(text, { hardMaxChars: 1 });

    expect(chunks).toEqual(["a", "👩‍🔬", "b"]);
    expect(chunks.join("")).toBe(text);
  });
});

describe("reply bubble delivery", () => {
  test("adds typing and delay before follow-up bubbles", async () => {
    const events: string[] = [];

    const sent = await sendReplyBubbles(
      "+15551234567",
      ["First sentence.", "Second sentence.", "Third sentence."],
      {
        delayMs: () => 123,
        send: async (_phone, text) => {
          events.push(`send:${text}`);
        },
        sleep: async (ms) => {
          events.push(`sleep:${ms}`);
        },
        typing: async (phone) => {
          events.push(`typing:${phone}`);
        },
      },
    );

    expect(sent).toBe(3);
    expect(events).toEqual([
      "send:First sentence.",
      "typing:+15551234567",
      "sleep:123",
      "send:Second sentence.",
      "typing:+15551234567",
      "sleep:123",
      "send:Third sentence.",
    ]);
  });
});
