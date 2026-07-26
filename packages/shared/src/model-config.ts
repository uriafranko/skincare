export const DEFAULT_AI_GATEWAY_MODEL = "google/gemini-3.5-flash";

export interface AiGatewayModelEnv {
  [key: string]: string | undefined;
  AI_GATEWAY_DEFAULT_MODEL?: string;
  AI_GATEWAY_MEMORY_MODEL?: string;
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
