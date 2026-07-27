import { describe, expect, test } from "bun:test";
import {
  DEFAULT_AI_GATEWAY_MODEL,
  resolveDefaultModelName,
  resolveMemoryModelName,
} from "../model-config";

describe("AI Gateway model config", () => {
  test("uses the built-in default when no env override is set", () => {
    expect(DEFAULT_AI_GATEWAY_MODEL).toBe("openai/gpt-5.6-luna");
    expect(resolveDefaultModelName({})).toBe(DEFAULT_AI_GATEWAY_MODEL);
  });

  test("uses env override values when provided", () => {
    expect(resolveDefaultModelName({ AI_GATEWAY_DEFAULT_MODEL: "openai/test-main" })).toBe(
      "openai/test-main",
    );
  });

  test("falls back to the default model for memory unless explicitly overridden", () => {
    expect(
      resolveMemoryModelName({
        AI_GATEWAY_DEFAULT_MODEL: "openai/test-main",
      }),
    ).toBe("openai/test-main");

    expect(
      resolveMemoryModelName({
        AI_GATEWAY_DEFAULT_MODEL: "openai/test-main",
        AI_GATEWAY_MEMORY_MODEL: "openai/test-memory",
      }),
    ).toBe("openai/test-memory");
  });

  test("treats blank env values as unset", () => {
    expect(
      resolveMemoryModelName({
        AI_GATEWAY_DEFAULT_MODEL: " ",
        AI_GATEWAY_MEMORY_MODEL: "",
      }),
    ).toBe(DEFAULT_AI_GATEWAY_MODEL);
  });
});
