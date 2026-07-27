import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import {
  MastraPlatformExporter,
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";
import { mastraStorage, skintextMemory } from "./memory";
import { getDefaultModelName } from "./models";
import { buildSkintextSystemPrompt } from "./prompts";
import {
  createSkintextRequestContext,
  getSkintextRuntime,
  type SkintextRuntime,
  skintextMemoryOptions,
} from "./runtime";
import { skintextAgentTools } from "./tools/agent-tools";

const PROMPT_CACHE_KEY = "zoey-agent-v1";

export const skintextAgent = new Agent({
  id: "skintext-agent",
  name: "Zoey",
  model: getDefaultModelName(),
  memory: skintextMemory,
  instructions: ({ requestContext }) =>
    buildSkintextSystemPrompt(getSkintextRuntime(requestContext).agentContext),
  tools: skintextAgentTools,
});

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: { skintextAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: "zoey",
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
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
  try {
    const agent = mastra.getAgent("skintextAgent");
    const result = await agent.generate(buildUserMessage(input), {
      requestContext: createSkintextRequestContext(runtime),
      memory: skintextMemoryOptions(runtime.userId, input.hasImage),
      maxSteps: 15,
      autoResumeSuspendedTools: true,
      toolCallConcurrency: 1,
      tracingOptions: {
        hideInput: true,
        hideOutput: true,
      },
      providerOptions: {
        openai: {
          promptCacheKey: PROMPT_CACHE_KEY,
        },
      },
    });

    if (input.hasImage && !runtime.accountDeleted) {
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

    return result;
  } finally {
    await mastra.observability.flush();
  }
}
