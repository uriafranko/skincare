import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { deleteUserMemory, mastraStorage, skintextMemory } from "./memory";
import { getDefaultModelName } from "./models";
import { buildSkintextSystemPrompt } from "./prompts";
import {
  createSkintextRequestContext,
  getSkintextRuntime,
  type SkintextRuntime,
  skintextMemoryOptions,
} from "./runtime";
import { skintextAgentTools } from "./tools/agent-tools";

const PROMPT_CACHE_KEY = "skintext-agent-v1";

export const skintextAgent = new Agent({
  id: "skintext-agent",
  name: "Skintext",
  model: getDefaultModelName(),
  memory: skintextMemory,
  instructions: ({ requestContext }) =>
    buildSkintextSystemPrompt(getSkintextRuntime(requestContext).agentContext),
  tools: skintextAgentTools,
});

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: { skintextAgent },
});

export interface RunSkintextAgentInput {
  text: string;
  imageUrl?: string;
  hasImage?: boolean;
}

function buildUserMessage({ text, imageUrl }: RunSkintextAgentInput) {
  if (!imageUrl) {
    return text;
  }
  const imageMarker = text
    ? `${text}\n\n[User attached a skincare/product photo]`
    : "[User sent a skincare/product photo]";

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: imageMarker },
        { type: "image" as const, image: imageUrl },
      ],
    },
  ];
}

export async function runSkintextAgent(input: RunSkintextAgentInput, runtime: SkintextRuntime) {
  const agent = mastra.getAgent("skintextAgent");
  const result = await agent.generate(buildUserMessage(input), {
    requestContext: createSkintextRequestContext(runtime),
    memory: skintextMemoryOptions(runtime.userId, input.hasImage),
    maxSteps: 15,
    providerOptions: {
      openai: {
        promptCacheKey: PROMPT_CACHE_KEY,
      },
    },
  });

  if (input.hasImage && !runtime.accountDeleted && !runtime.clearMemoryAfterRun) {
    if (
      runtime.photoRetentionEnabled &&
      runtime.saveCurrentPhoto &&
      !runtime.currentPhotoSaved &&
      !runtime.skipCurrentPhotoRetention
    ) {
      try {
        runtime.currentPhotoSaved = await runtime.saveCurrentPhoto();
      } catch (error) {
        runtime.photoSaveError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  if (runtime.accountDeleted || runtime.clearMemoryAfterRun) {
    await deleteUserMemory(runtime.userId);
  }

  return result;
}
