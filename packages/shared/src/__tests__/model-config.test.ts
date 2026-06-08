import { describe, expect, test } from "bun:test";
import {
  DEFAULT_AI_GATEWAY_MODEL,
  resolveCompactionGatewayModelName,
  resolveDefaultGatewayModelName,
} from "../model-config";

describe("AI Gateway model config", () => {
  test("uses the built-in default when no env override is set", () => {
    expect(resolveDefaultGatewayModelName({})).toBe(DEFAULT_AI_GATEWAY_MODEL);
  });

  test("uses env override values when provided", () => {
    expect(resolveDefaultGatewayModelName({ AI_GATEWAY_DEFAULT_MODEL: "openai/test-main" })).toBe(
      "openai/test-main",
    );
  });

  test("falls back to the default model for compaction unless explicitly overridden", () => {
    expect(
      resolveCompactionGatewayModelName({
        AI_GATEWAY_DEFAULT_MODEL: "openai/test-main",
      }),
    ).toBe("openai/test-main");

    expect(
      resolveCompactionGatewayModelName({
        AI_GATEWAY_DEFAULT_MODEL: "openai/test-main",
        AI_GATEWAY_COMPACTION_MODEL: "openai/test-compact",
      }),
    ).toBe("openai/test-compact");
  });

  test("treats blank env values as unset", () => {
    expect(
      resolveCompactionGatewayModelName({
        AI_GATEWAY_DEFAULT_MODEL: " ",
        AI_GATEWAY_COMPACTION_MODEL: "",
      }),
    ).toBe(DEFAULT_AI_GATEWAY_MODEL);
  });
});
