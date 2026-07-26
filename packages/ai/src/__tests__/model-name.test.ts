import { describe, expect, test } from "bun:test";
import { toMastraModelName } from "../model-name";

describe("Mastra model names", () => {
  test("routes existing Gateway model IDs through Mastra's Vercel provider", () => {
    expect(toMastraModelName("google/gemini-3.5-flash")).toBe("vercel/google/gemini-3.5-flash");
  });

  test("does not duplicate an existing provider prefix", () => {
    expect(toMastraModelName("vercel/google/gemini-3.5-flash")).toBe(
      "vercel/google/gemini-3.5-flash",
    );
  });
});
