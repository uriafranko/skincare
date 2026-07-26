import type { OnboardingState } from "@skintext/shared";
import { resolveDefaultModelName } from "@skintext/shared/model-config";
import { isLocalOnboardingComplete, mergeOnboardingState } from "./onboarding-state";
import { advanceStubOnboarding } from "./stub-onboarding";
import type { RuntimeMode, SimulationRuntime } from "./types";

type ProcessLiveOnboardingMessage = (
  text: string,
  state: OnboardingState,
  ctx: {
    isFirstMessage: boolean;
    timezone: string;
    locale: string;
    complete?: boolean;
  },
  generate?: (prompt: string) => Promise<Record<string, unknown>>,
) => Promise<{ extracted: Partial<OnboardingState>; reply: string }>;

export interface OnboardingRuntimeOptions {
  mode: RuntimeMode;
  model?: string;
  locale?: string;
  timezone?: string;
}

function resolveMode(mode: RuntimeMode): Exclude<RuntimeMode, "auto"> {
  if (mode !== "auto") return mode;
  return process.env.AI_GATEWAY_API_KEY ? "live" : "stub";
}

function createStubOnboardingRuntime(options: OnboardingRuntimeOptions): SimulationRuntime {
  let state: OnboardingState = {};

  return {
    id: "onboarding:stub",
    async receive(text, ctx) {
      if (!state.timezone && (options.timezone || ctx.scenario.timezone)) {
        state.timezone = options.timezone ?? ctx.scenario.timezone;
        state.timezoneConfirmed = true;
      }

      const result = advanceStubOnboarding(text, state, ctx.turn === 0);
      state = result.state;
      return {
        messages: [result.reply],
        state,
        complete: result.complete,
      };
    },
  };
}

async function processLiveOnboardingMessage(
  text: string,
  state: OnboardingState,
  ctx: {
    isFirstMessage: boolean;
    timezone: string;
    locale: string;
    complete?: boolean;
  },
  modelName: string,
) {
  const moduleUrl = new URL("../../ai/src/onboarding.ts", import.meta.url).href;
  const { createOnboardingGenerator, processOnboardingMessage } = (await import(moduleUrl)) as {
    createOnboardingGenerator: (
      modelName?: string,
    ) => (prompt: string) => Promise<Record<string, unknown>>;
    processOnboardingMessage: ProcessLiveOnboardingMessage;
  };
  return processOnboardingMessage(text, state, ctx, createOnboardingGenerator(modelName));
}

function createLiveOnboardingRuntime(options: OnboardingRuntimeOptions): SimulationRuntime {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required for --system live.");
  }

  const modelName = options.model ?? resolveDefaultModelName(process.env);
  let state: OnboardingState = {};

  return {
    id: `onboarding:live:${modelName}`,
    async receive(text, ctx) {
      const timezone = options.timezone ?? ctx.scenario.timezone;
      const locale = options.locale ?? ctx.scenario.locale;

      if (!state.timezone && timezone) {
        state.timezone = timezone;
        state.timezoneConfirmed = true;
      }

      const { extracted, reply } = await processLiveOnboardingMessage(
        text,
        state,
        {
          isFirstMessage: ctx.turn === 0,
          timezone,
          locale,
        },
        modelName,
      );

      const merged = mergeOnboardingState(state, extracted);
      const complete = isLocalOnboardingComplete(merged);

      if (complete) {
        const completeResult = await processLiveOnboardingMessage(
          text,
          merged,
          {
            isFirstMessage: false,
            timezone,
            locale,
            complete: true,
          },
          modelName,
        );
        state = { ...merged, lastBotReply: completeResult.reply };
        return {
          messages: [completeResult.reply],
          state,
          complete: true,
          metadata: { extracted },
        };
      }

      state = { ...merged, lastBotReply: reply };
      return {
        messages: [reply],
        state,
        complete: false,
        metadata: { extracted },
      };
    },
  };
}

export function createOnboardingRuntime(options: OnboardingRuntimeOptions): SimulationRuntime {
  const mode = resolveMode(options.mode);
  if (mode === "live") return createLiveOnboardingRuntime(options);
  return createStubOnboardingRuntime(options);
}

export function resolvedRuntimeMode(mode: RuntimeMode): Exclude<RuntimeMode, "auto"> {
  return resolveMode(mode);
}
