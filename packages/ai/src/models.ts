import type { MastraModelConfig } from "@mastra/core/llm";
import * as shared from "@skintext/shared";
import { toMastraModelName } from "./model-name";

export { toMastraModelName };

export function getDefaultModelName(): MastraModelConfig {
  return toMastraModelName(shared.resolveDefaultModelName(shared.env));
}

export function getMemoryModelName(): MastraModelConfig {
  return toMastraModelName(shared.resolveMemoryModelName(shared.env));
}
