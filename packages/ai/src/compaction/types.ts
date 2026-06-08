import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { ModelMessage } from "ai";
import { INTERNAL_METADATA_KEY } from "./constants";

export interface MessageCompactionOptions {
  model?: LanguageModelV3;
  systemPrompt?: string;
  /**
   * Deprecated compatibility option. Prefer reserveTokens so the decision is
   * independent of context-window size.
   */
  threshold?: number;
  contextWindowTokens?: number;
  keepRecentTokens?: number;
  reserveTokens?: number;
}

export interface MessageCompactionResult {
  messages: ModelMessage[];
  compacted: boolean;
  tokensBefore: number;
  thresholdTokens: number;
  reserveTokens: number;
  usageEstimate: ContextUsageEstimate;
  error?: unknown;
}

export interface PersistedMessageUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  systemPromptTokens?: number;
  estimatedInputTokens?: number;
  createdAt: string;
}

export interface SkintextMessageMetadata {
  usage?: PersistedMessageUsage;
}

export type StoredModelMessage = ModelMessage & {
  [INTERNAL_METADATA_KEY]?: SkintextMessageMetadata;
};

export interface ContentUsageEstimate {
  tokens: number;
  imageTokens: number;
  imageCount: number;
  imagePayloadBytes: number;
  imageDataUrlCount: number;
  imageRemoteUrlCount: number;
}

export interface ContextUsageEstimate extends ContentUsageEstimate {
  estimatedTokens: number;
  systemTokens: number;
  usageTokens: number;
  trailingTokens: number;
  lastUsageIndex: number | null;
}
