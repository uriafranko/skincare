import type { MastraModelConfig } from "@mastra/core/llm";
import * as shared from "@skintext/shared";
import { toMastraModelName } from "./models";

export function getDefaultModelName(): MastraModelConfig {
  return toMastraModelName(shared.resolveDefaultModelName(shared.env));
}

export function getMemoryModelName(): MastraModelConfig {
  return toMastraModelName(shared.resolveMemoryModelName(shared.env));
}

export function getDefaultProviderOptions() {
  return {
    openai: {
      reasoningEffort: shared.resolveReasoningEffort(shared.env),
    },
  };
}
