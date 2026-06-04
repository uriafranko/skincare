import { describe, expect, test } from "bun:test";
import { sendReplyBubbles, splitReplyIntoBubbles } from "../replies";

describe("reply bubble splitting", () => {
  test("keeps short replies as one bubble", () => {
    expect(splitReplyIntoBubbles("Done - I logged your evening routine.")).toEqual([
      "Done - I logged your evening routine.",
    ]);
  });

  test("splits conversational replies at sentence boundaries", () => {
    const text =
      "Start with the cleanser tonight. Skip the exfoliant for two days. Add moisturizer while the redness settles.";

    expect(
      splitReplyIntoBubbles(text, {
        minChars: 25,
        maxChars: 75,
      }),
    ).toEqual([
      "Start with the cleanser tonight. Skip the exfoliant for two days.",
      "Add moisturizer while the redness settles.",
    ]);
  });

  test("prefers paragraph boundaries for longer replies", () => {
    const text =
      "That sounds like irritation from too much at once.\n\nPause the scrub and retinoid tonight.\n\nUse cleanser, moisturizer, and sunscreen tomorrow.";

    expect(
      splitReplyIntoBubbles(text, {
        minChars: 20,
        maxChars: 80,
      }),
    ).toEqual([
      "That sounds like irritation from too much at once.",
      "Pause the scrub and retinoid tonight.",
      "Use cleanser, moisturizer, and sunscreen tomorrow.",
    ]);
  });

  test("does not split structured status replies for style", () => {
    const text = "Today\nAM: done\nPM: not logged\nProducts: cleanser\nNotes: none";

    expect(
      splitReplyIntoBubbles(text, {
        minChars: 10,
        maxChars: 20,
      }),
    ).toEqual([text]);
  });

  test("hard-splits oversized text when no natural boundary exists", () => {
    const text = "x".repeat(95);
    const chunks = splitReplyIntoBubbles(text, {
      hardMaxChars: 40,
      maxChars: 30,
      minChars: 10,
    });

    expect(chunks.every((chunk) => chunk.length <= 40)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });
});

describe("reply bubble delivery", () => {
  test("adds typing and delay before follow-up bubbles", async () => {
    const events: string[] = [];

    const sent = await sendReplyBubbles(
      "+15551234567",
      ["First sentence. Second sentence. Third sentence."],
      {
        delayMs: () => 123,
        maxChars: 25,
        minChars: 10,
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
