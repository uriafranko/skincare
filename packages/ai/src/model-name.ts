import type { MastraModelConfig } from "@mastra/core/llm";

export function toMastraModelName(model: string): MastraModelConfig {
  const normalized = model.trim();
  return (
    normalized.startsWith("vercel/") ? normalized : `vercel/${normalized}`
  ) as MastraModelConfig;
}
