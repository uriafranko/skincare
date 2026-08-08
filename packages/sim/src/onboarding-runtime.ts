import type { OnboardingGenerator, OnboardingResult } from "@skintext/ai";
import {
  isOnboardingComplete,
  mergeOnboardingState,
  type OnboardingState,
  sanitizeOnboardingExtraction,
} from "@skintext/shared";
import { resolveDefaultModelName } from "@skintext/shared/model-config";
import { advanceStubOnboarding } from "./stub-onboarding";
import type { RuntimeMode, SimulationRuntime } from "./types";

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
  },
  modelName: string,
): Promise<OnboardingResult> {
  const { createOnboardingGenerator, processOnboardingMessage } = await import("@skintext/ai");
  const generate: OnboardingGenerator = createOnboardingGenerator(modelName);
  return processOnboardingMessage(text, state, ctx, generate);
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

      const sanitized = sanitizeOnboardingExtraction(state, extracted);
      const merged = mergeOnboardingState(state, sanitized);
      const complete = isOnboardingComplete(merged);
      state = { ...merged, lastBotReply: reply };
      return {
        messages: [reply],
        state,
        complete,
        metadata: { extracted: sanitized },
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
