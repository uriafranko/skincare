export const DEFAULT_AI_GATEWAY_MODEL = "openai/gpt-5.6-luna";
export const DEFAULT_AI_GATEWAY_REASONING_EFFORT = "medium" as const;
export const AI_GATEWAY_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type AiGatewayReasoningEffort = (typeof AI_GATEWAY_REASONING_EFFORTS)[number];

export interface AiGatewayModelEnv {
  [key: string]: string | undefined;
  AI_GATEWAY_DEFAULT_MODEL?: string;
  AI_GATEWAY_MEMORY_MODEL?: string;
  AI_GATEWAY_REASONING_EFFORT?: string;
}

function normalizeModelName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveDefaultModelName(source: AiGatewayModelEnv): string {
  return normalizeModelName(source.AI_GATEWAY_DEFAULT_MODEL) ?? DEFAULT_AI_GATEWAY_MODEL;
}

export function resolveMemoryModelName(source: AiGatewayModelEnv): string {
  return normalizeModelName(source.AI_GATEWAY_MEMORY_MODEL) ?? resolveDefaultModelName(source);
}

export function resolveReasoningEffort(source: AiGatewayModelEnv): AiGatewayReasoningEffort {
  const value = source.AI_GATEWAY_REASONING_EFFORT?.trim();
  return AI_GATEWAY_REASONING_EFFORTS.includes(value as AiGatewayReasoningEffort)
    ? (value as AiGatewayReasoningEffort)
    : DEFAULT_AI_GATEWAY_REASONING_EFFORT;
}
