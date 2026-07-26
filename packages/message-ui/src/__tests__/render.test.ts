import { describe, expect, test } from "bun:test";
import { renderMessageCard } from "../index";

describe("renderMessageCard", () => {
  test("renders a named attachment at iMessage-friendly resolution", async () => {
    const result = await renderMessageCard({
      kind: "routine",
      title: "Simple evening routine",
      subtitle: "Keep this gentle while your skin settles.",
      sections: [
        {
          heading: "Tonight",
          items: ["Cleanser", "Moisturizer", "Skip exfoliating acids"],
        },
      ],
      footer: "If irritation increases, pause new products.",
    });

    expect(result.filename).toBe("simple-evening-routine.png");
    expect(result.width).toBe(840);
    expect(result.height).toBeGreaterThanOrEqual(560);
    expect(result.svg).toStartWith("<svg");
    expect(result.svg).toContain('fill="#111612"');
    expect(result.svg.length).toBeGreaterThan(10_000);
  });
});
