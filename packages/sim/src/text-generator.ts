import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { resolveReasoningEffort } from "@skintext/shared/model-config";

function toMastraModelName(model: string): MastraModelConfig {
  const normalized = model.trim();
  return (
    normalized.startsWith("vercel/") ? normalized : `vercel/${normalized}`
  ) as MastraModelConfig;
}

export function createTextGenerator(options: { id: string; instructions: string; model: string }) {
  const agent = new Agent({
    id: options.id,
    name: options.id,
    instructions: options.instructions,
    model: toMastraModelName(options.model),
    defaultOptions: {
      providerOptions: {
        openai: {
          reasoningEffort: resolveReasoningEffort(process.env),
        },
      },
    },
  });

  return async (prompt: string): Promise<string> => {
    const result = await agent.generate(prompt);
    return result.text;
  };
}
