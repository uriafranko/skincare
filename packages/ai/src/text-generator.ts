import { Agent } from "@mastra/core/agent";
import { toMastraModelName } from "./model-name";

export function createTextGenerator(options: { id: string; instructions: string; model: string }) {
  const agent = new Agent({
    id: options.id,
    name: options.id,
    instructions: options.instructions,
    model: toMastraModelName(options.model),
  });

  return async (prompt: string): Promise<string> => {
    const result = await agent.generate(prompt);
    return result.text;
  };
}
