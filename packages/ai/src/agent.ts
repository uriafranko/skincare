import { Agent, type AgentMessageInput, type AgentRun } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { MastraPlatformExporter, Observability, SensitiveDataFilter } from "@mastra/observability";
import { RedisStreamsPubSub } from "@mastra/redis-streams";
import { env } from "@skintext/shared";
import { mastraStorage, skintextMemory } from "./memory";
import { getDefaultModelName, getDefaultProviderOptions } from "./model-runtime";
import { skintextOnboardingAgent } from "./onboarding";
import {
  buildMainAccountState,
  mainAccountStateCacheKey,
  serializeMainAccountState,
} from "./prompts/context";
import { buildSkintextSystemPrompt } from "./prompts/main";
import {
  createSkintextRequestContext,
  type SkintextRuntime,
  skintextMemoryOptions,
} from "./runtime";
import { skintextAgentTools } from "./tools/agent-tools";

const PROMPT_CACHE_KEY = "lily-agent-v2";
const MAIN_ACCOUNT_STATE_SIGNAL_ID = "account";
const CONFIRMATION_TOOL_NAMES = new Set([
  "deleteAccount",
  "deleteSavedPhotos",
  "delete-account",
  "delete-saved-photos",
]);

function createMastraPubSub() {
  if (!env.REDIS_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REDIS_URL is required for distributed Mastra signals in production.");
    }
    return undefined;
  }

  const environment = process.env.VERCEL_ENV?.trim() || "local";
  return new RedisStreamsPubSub({
    url: env.REDIS_URL,
    keyPrefix: `skintext:mastra:${environment}`,
  });
}

export const skintextAgent = new Agent({
  id: "skintext-agent",
  name: "Lily",
  model: getDefaultModelName(),
  defaultOptions: { providerOptions: getDefaultProviderOptions() },
  memory: skintextMemory,
  instructions: buildSkintextSystemPrompt(),
  tools: skintextAgentTools,
});

const pubsub = createMastraPubSub();

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: { skintextAgent, skintextOnboardingAgent },
  ...(pubsub ? { pubsub } : {}),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "lily",
        exporters: [new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});

export interface RunSkintextAgentInput {
  text: string;
  imageUrl?: string;
}

function imageMediaType(imageUrl: string): string {
  return /^data:([^;,]+)/.exec(imageUrl)?.[1] ?? "image/jpeg";
}

function buildUserSignal(
  { text, imageUrl }: RunSkintextAgentInput,
  runtime: SkintextRuntime,
): AgentMessageInput {
  const contents = imageUrl
    ? [
        {
          type: "text" as const,
          text: text
            ? `${text}\n\n[User attached a skincare/product photo]`
            : "[User sent a skincare/product photo]",
        },
        {
          type: "file" as const,
          data: imageUrl,
          mediaType: imageMediaType(imageUrl),
        },
      ]
    : text;

  return {
    contents,
    attributes: {
      minimumRiskState: runtime.agentContext.riskState,
      scheduledEvent: runtime.agentContext.isScheduledEvent,
      offerCommunicationStyle: runtime.agentContext.shouldOfferStyle,
      offerPhotoRetention: runtime.agentContext.shouldOfferPhotoRetention,
    },
  };
}

async function syncMainAccountState(
  agent: typeof skintextAgent,
  runtime: SkintextRuntime,
  target: { resourceId: string; threadId: string },
): Promise<void> {
  const state = buildMainAccountState(runtime.agentContext);
  const signal = await agent.sendStateSignal(
    {
      id: MAIN_ACCOUNT_STATE_SIGNAL_ID,
      mode: "snapshot",
      tagName: "account-state",
      cacheKey: mainAccountStateCacheKey(state),
      contents: serializeMainAccountState(state),
      value: state,
    },
    {
      ...target,
      ifActive: { behavior: "deliver" },
      ifIdle: { behavior: "persist" },
    },
  );

  if (signal.skipped) return;
  const accepted = await signal.accepted;
  if (accepted.action === "deliver") return;
  if (accepted.action === "persist") {
    await signal.persisted;
    return;
  }
  throw new Error(`Unexpected main account state-signal action: ${accepted.action}.`);
}

function withSeparatedStepText<
  T extends { text: string; steps: Array<{ text?: string }>; runId?: string },
>(result: T, runId: string): T & { runId: string } {
  const stepText = result.steps
    .map((step) => step.text?.trim())
    .filter((text): text is string => !!text)
    .join("\n\n");

  return {
    ...result,
    text: stepText || result.text,
    runId: result.runId ?? runId,
  };
}

function isExplicitConfirmation(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase();
  const boundary = String.raw`(?:[\s,.!?]|$)`;
  return new RegExp(
    `^(?:yes|yep|yeah|confirm|confirmed|כן|מאשר|מאשרת|תמחק|תמחקי|ja|bekräfta)${boundary}`,
    "u",
  ).test(normalized);
}

function confirmationRun(runs: AgentRun[]): AgentRun | undefined {
  return [...runs]
    .sort((left, right) => right.suspendedAt.getTime() - left.suspendedAt.getTime())
    .find((run) => run.toolCalls.some((tool) => CONFIRMATION_TOOL_NAMES.has(tool.toolName ?? "")));
}

function streamOptions(runtime: SkintextRuntime) {
  const { hasImage, userId } = runtime.agentContext;
  const providerOptions = getDefaultProviderOptions();
  return {
    requestContext: createSkintextRequestContext(runtime),
    memory: skintextMemoryOptions(userId, hasImage),
    maxSteps: 15,
    toolCallConcurrency: 1,
    tracingOptions: {
      hideInput: true,
      hideOutput: true,
    },
    providerOptions: {
      ...providerOptions,
      openai: {
        ...providerOptions.openai,
        promptCacheKey: PROMPT_CACHE_KEY,
      },
    },
  };
}

async function resumeConfirmation(
  agent: typeof skintextAgent,
  run: AgentRun,
  input: RunSkintextAgentInput,
  runtime: SkintextRuntime,
) {
  const toolCall = run.toolCalls.find((tool) => CONFIRMATION_TOOL_NAMES.has(tool.toolName ?? ""));
  const output = await agent.resumeStream(
    { confirmed: isExplicitConfirmation(input.text) },
    {
      ...streamOptions(runtime),
      runId: run.runId,
      toolCallId: toolCall?.toolCallId,
    },
  );
  const result = await output.getFullOutput();
  return withSeparatedStepText(result, run.runId);
}

export async function runSkintextAgent(input: RunSkintextAgentInput, runtime: SkintextRuntime) {
  try {
    const agent = mastra.getAgent("skintextAgent");
    const { hasImage, userId } = runtime.agentContext;
    const threadId = skintextMemoryOptions(userId).thread;
    const target = { resourceId: userId, threadId };
    const suspended = await agent.listSuspendedRuns({
      ...target,
      perPage: 10,
      page: 0,
    });
    const pendingConfirmation = confirmationRun(suspended.runs);
    if (pendingConfirmation) {
      return await resumeConfirmation(agent, pendingConfirmation, input, runtime);
    }

    await syncMainAccountState(agent, runtime, target);

    const delivery = agent.sendMessage(buildUserSignal(input, runtime), {
      ...target,
      ifActive: {
        behavior: "deliver",
      },
      ifIdle: {
        behavior: "wake",
        streamOptions: streamOptions(runtime),
      },
    });
    const accepted = await delivery.accepted;

    if (accepted.action === "deliver") {
      return null;
    }
    if (accepted.action === "blocked") {
      const refreshed = await agent.listSuspendedRuns({
        ...target,
        perPage: 10,
        page: 0,
      });
      const blockedConfirmation = confirmationRun(refreshed.runs);
      if (blockedConfirmation) {
        return await resumeConfirmation(agent, blockedConfirmation, input, runtime);
      }
      throw new Error(`Mastra thread is blocked by run ${accepted.runId}.`);
    }
    if (accepted.action !== "wake") {
      throw new Error(`Unexpected Mastra message action: ${accepted.action}.`);
    }

    const result = withSeparatedStepText(await accepted.output.getFullOutput(), accepted.runId);

    if (
      hasImage &&
      !runtime.accountDeleted &&
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

    return result;
  } finally {
    await mastra.observability.flush();
  }
}
