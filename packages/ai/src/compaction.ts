import type { LanguageModelV3 } from "@ai-sdk/provider";
import { env } from "@skintext/shared";
import { generateText, type LanguageModelUsage, type ModelMessage } from "ai";
import { createCompactionGatewayModel } from "./models";

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;
export const DEFAULT_COMPACTION_RESERVE_TOKENS = 20_000;
export const RESCUE_COMPACTION_RESERVE_TOKENS = 12_000;
export const DEFAULT_KEEP_RECENT_TOKENS = 20_000;
export const DEFAULT_COMPACTION_MODEL = "openai/gpt-5.4-nano";

const SUMMARY_MARKER = "[Skintext conversation summary]";
const ESTIMATED_IMAGE_TOKENS = 1_200;
const INTERNAL_METADATA_KEY = "_skintext";

const SUMMARY_SYSTEM_PROMPT = `You summarize Skintext conversation history for another Skintext assistant.
Do not answer the user. Do not continue the conversation.
Only produce a concise context summary that preserves facts needed for future replies.`;

const SUMMARY_PROMPT = `Create a compact Skintext conversation summary using this exact format:

## User Profile Context
- [Durable user facts, preferences, sensitivities, allergies, goals, products, or "(none)"]

## Recent Progress
- [Important skincare advice, routine changes, logged actions, reminders, or "(none)"]

## Open Threads
- [Questions, pending follow-ups, unresolved tasks, or "(none)"]

## Critical Details
- [Exact product names, dates, reactions, constraints, or "(none)"]

Keep it concise. Preserve exact names, dates, allergies, and safety-relevant details.`;

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

export function getCompactionModelName(): string {
  return env.AI_GATEWAY_COMPACTION_MODEL || DEFAULT_COMPACTION_MODEL;
}

export function createCompactionSummaryMessage(summary: string): ModelMessage {
  return {
    role: "system",
    content: `${SUMMARY_MARKER}\n${summary.trim()}`,
  };
}

export function isCompactionSummaryMessage(message: ModelMessage): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.startsWith(SUMMARY_MARKER)
  );
}

function getSummaryText(message: ModelMessage): string | undefined {
  if (!isCompactionSummaryMessage(message)) return undefined;
  return String(message.content).slice(SUMMARY_MARKER.length).trim();
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "[unserializable]";
  }
}

function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function emptyUsageEstimate(): ContentUsageEstimate {
  return {
    tokens: 0,
    imageTokens: 0,
    imageCount: 0,
    imagePayloadBytes: 0,
    imageDataUrlCount: 0,
    imageRemoteUrlCount: 0,
  };
}

function addContentUsage(
  target: ContentUsageEstimate,
  addition: ContentUsageEstimate,
): ContentUsageEstimate {
  target.tokens += addition.tokens;
  target.imageTokens += addition.imageTokens;
  target.imageCount += addition.imageCount;
  target.imagePayloadBytes += addition.imagePayloadBytes;
  target.imageDataUrlCount += addition.imageDataUrlCount;
  target.imageRemoteUrlCount += addition.imageRemoteUrlCount;
  return target;
}

function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function estimateTextBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function estimateUrlEncodedBytes(value: string): number {
  try {
    return estimateTextBytes(decodeURIComponent(value));
  } catch {
    return estimateTextBytes(value);
  }
}

function estimateBinaryPayloadBytes(value: unknown): {
  bytes: number;
  dataUrl: boolean;
  remoteUrl: boolean;
} {
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      const commaIndex = value.indexOf(",");
      if (commaIndex === -1) return { bytes: value.length, dataUrl: true, remoteUrl: false };

      const header = value.slice(0, commaIndex);
      const payload = value.slice(commaIndex + 1);
      const bytes = header.includes(";base64")
        ? estimateBase64Bytes(payload)
        : estimateUrlEncodedBytes(payload);
      return { bytes, dataUrl: true, remoteUrl: false };
    }

    if (/^https?:\/\//i.test(value)) {
      return { bytes: 0, dataUrl: false, remoteUrl: true };
    }

    return { bytes: estimateTextBytes(value), dataUrl: false, remoteUrl: false };
  }

  if (value instanceof Uint8Array) {
    return { bytes: value.byteLength, dataUrl: false, remoteUrl: false };
  }

  if (value instanceof ArrayBuffer) {
    return { bytes: value.byteLength, dataUrl: false, remoteUrl: false };
  }

  if (value instanceof URL) {
    if (value.protocol === "data:") return estimateBinaryPayloadBytes(value.toString());
    if (value.protocol === "http:" || value.protocol === "https:") {
      return { bytes: 0, dataUrl: false, remoteUrl: true };
    }
  }

  return { bytes: 0, dataUrl: false, remoteUrl: false };
}

function estimateContentUsage(content: unknown): ContentUsageEstimate {
  if (typeof content === "string") {
    return { ...emptyUsageEstimate(), tokens: estimateTextTokens(content) };
  }
  if (!Array.isArray(content)) {
    return { ...emptyUsageEstimate(), tokens: estimateTextTokens(safeJson(content)) };
  }

  const usage = emptyUsageEstimate();
  for (const part of content as Array<Record<string, unknown>>) {
    if (part.type === "text" && typeof part.text === "string") {
      usage.tokens += estimateTextTokens(part.text);
      continue;
    }

    if (part.type === "image" || part.type === "file") {
      usage.tokens += ESTIMATED_IMAGE_TOKENS;
      usage.imageTokens += ESTIMATED_IMAGE_TOKENS;
      usage.imageCount += 1;

      const payload = estimateBinaryPayloadBytes(part.type === "file" ? part.data : part.image);
      usage.imagePayloadBytes += payload.bytes;
      if (payload.dataUrl) usage.imageDataUrlCount += 1;
      if (payload.remoteUrl) usage.imageRemoteUrlCount += 1;
      continue;
    }

    usage.tokens += estimateTextTokens(safeJson(part));
  }
  return usage;
}

export function estimateMessageUsage(message: ModelMessage): ContentUsageEstimate {
  const contentUsage = estimateContentUsage(message.content);
  return {
    ...contentUsage,
    tokens: 4 + estimateTextTokens(message.role) + contentUsage.tokens,
  };
}

export function estimateMessageTokens(message: ModelMessage): number {
  return estimateMessageUsage(message).tokens;
}

function estimateMessagesWithoutSystem(messages: ModelMessage[]): ContentUsageEstimate {
  const usage = emptyUsageEstimate();
  for (const message of messages) addContentUsage(usage, estimateMessageUsage(message));
  return usage;
}

function getInternalMetadata(message: ModelMessage): SkintextMessageMetadata | undefined {
  return (message as StoredModelMessage)[INTERNAL_METADATA_KEY];
}

function usageContextTokens(usage: PersistedMessageUsage): number | undefined {
  if (usage.inputTokens != null || usage.outputTokens != null) {
    return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  }

  return usage.totalTokens;
}

function getLastUsageInfo(messages: ModelMessage[]): {
  usage: PersistedMessageUsage;
  index: number;
} | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;

    const usage = getInternalMetadata(message)?.usage;
    if (usage && usageContextTokens(usage) != null) return { usage, index: i };
  }

  return null;
}

export function estimateMessagesContextUsage(
  messages: ModelMessage[],
  systemPrompt?: string,
): ContextUsageEstimate {
  const systemTokens = systemPrompt ? estimateTextTokens(systemPrompt) : 0;
  const estimatedMessagesUsage = estimateMessagesWithoutSystem(messages);
  const estimatedTokens = systemTokens + estimatedMessagesUsage.tokens;

  const usageInfo = getLastUsageInfo(messages);
  if (!usageInfo) {
    return {
      ...estimatedMessagesUsage,
      tokens: estimatedTokens,
      estimatedTokens,
      systemTokens,
      usageTokens: 0,
      trailingTokens: estimatedMessagesUsage.tokens,
      lastUsageIndex: null,
    };
  }

  const actualUsageTokens = usageContextTokens(usageInfo.usage) ?? 0;
  const previousSystemTokens = usageInfo.usage.systemPromptTokens ?? 0;
  const trailingUsage = estimateMessagesWithoutSystem(messages.slice(usageInfo.index + 1));
  const anchoredTokens =
    Math.max(0, actualUsageTokens - previousSystemTokens) + systemTokens + trailingUsage.tokens;

  return {
    ...estimatedMessagesUsage,
    tokens: anchoredTokens,
    estimatedTokens,
    systemTokens,
    usageTokens: actualUsageTokens,
    trailingTokens: trailingUsage.tokens,
    lastUsageIndex: usageInfo.index,
  };
}

export function estimateMessagesTokens(messages: ModelMessage[], systemPrompt?: string): number {
  return estimateMessagesContextUsage(messages, systemPrompt).tokens;
}

function definedNumber(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function createPersistedUsageMetadata(
  usage: LanguageModelUsage,
  options: { systemPrompt?: string; estimatedInputTokens?: number } = {},
): PersistedMessageUsage | null {
  const inputTokens = definedNumber(usage.inputTokens);
  const outputTokens = definedNumber(usage.outputTokens);
  const totalTokens = definedNumber(usage.totalTokens);
  const cacheReadTokens = definedNumber(usage.inputTokenDetails?.cacheReadTokens);
  const cacheWriteTokens = definedNumber(usage.inputTokenDetails?.cacheWriteTokens);
  const estimatedInputTokens = definedNumber(options.estimatedInputTokens);

  if (inputTokens == null && outputTokens == null && totalTokens == null) return null;

  return {
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
    ...(totalTokens != null ? { totalTokens } : {}),
    ...(cacheReadTokens != null ? { cacheReadTokens } : {}),
    ...(cacheWriteTokens != null ? { cacheWriteTokens } : {}),
    ...(options.systemPrompt
      ? { systemPromptTokens: estimateTextTokens(options.systemPrompt) }
      : {}),
    ...(estimatedInputTokens != null ? { estimatedInputTokens } : {}),
    createdAt: new Date().toISOString(),
  };
}

export function annotateLastAssistantMessageUsage(
  messages: ModelMessage[],
  usage: LanguageModelUsage,
  options: { systemPrompt?: string; estimatedInputTokens?: number } = {},
): StoredModelMessage[] {
  const usageMetadata = createPersistedUsageMetadata(usage, options);
  if (!usageMetadata) return messages as StoredModelMessage[];

  const annotated = [...(messages as StoredModelMessage[])];
  for (let i = annotated.length - 1; i >= 0; i--) {
    const message = annotated[i];
    if (message?.role !== "assistant") continue;

    annotated[i] = {
      ...message,
      [INTERNAL_METADATA_KEY]: {
        ...message[INTERNAL_METADATA_KEY],
        usage: usageMetadata,
      },
    };
    break;
  }

  return annotated;
}

export function stripInternalMessageMetadata(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => {
    const { [INTERNAL_METADATA_KEY]: _metadata, ...clean } = message as StoredModelMessage;
    return clean as ModelMessage;
  });
}

function messageToolCallIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  if (message.role !== "assistant" || !Array.isArray(message.content)) return ids;

  for (const part of message.content as Array<Record<string, unknown>>) {
    if (part.type === "tool-call" && typeof part.toolCallId === "string") {
      ids.add(part.toolCallId);
    }
  }

  return ids;
}

function messageToolResultIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  if (message.role !== "tool" && message.role !== "assistant") return ids;
  if (!Array.isArray(message.content)) return ids;

  for (const part of message.content as Array<Record<string, unknown>>) {
    if (part.type === "tool-result" && typeof part.toolCallId === "string") {
      ids.add(part.toolCallId);
    }
  }

  return ids;
}

function hasDanglingToolResults(messages: ModelMessage[], startIndex: number): boolean {
  const retainedToolCalls = new Set<string>();

  for (let i = startIndex; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;

    for (const toolCallId of messageToolCallIds(message)) {
      retainedToolCalls.add(toolCallId);
    }

    for (const toolCallId of messageToolResultIds(message)) {
      if (!retainedToolCalls.has(toolCallId)) return true;
    }
  }

  return false;
}

function findSafeTailStart(messages: ModelMessage[], candidate: number): number {
  if (candidate <= 0) return 0;

  for (let i = candidate; i < messages.length; i++) {
    if (messages[i]?.role === "user") return i;
  }

  let safeCandidate = candidate;
  while (safeCandidate > 0 && hasDanglingToolResults(messages, safeCandidate)) {
    safeCandidate--;
  }

  return safeCandidate;
}

function findTailStart(messages: ModelMessage[], keepRecentTokens: number): number {
  if (messages.length <= 1) return 0;

  let accumulated = 0;
  let candidate = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message) continue;
    accumulated += estimateMessageTokens(message);
    if (accumulated >= keepRecentTokens) {
      candidate = i;
      break;
    }
  }

  return findSafeTailStart(messages, candidate);
}

function extractExistingSummary(messages: ModelMessage[]): {
  previousSummary?: string;
  messagesWithoutSummaries: ModelMessage[];
} {
  const summaries: string[] = [];
  const messagesWithoutSummaries: ModelMessage[] = [];

  for (const message of messages) {
    const summary = getSummaryText(message);
    if (summary) {
      summaries.push(summary);
    } else {
      messagesWithoutSummaries.push(message);
    }
  }

  return {
    previousSummary: summaries.length > 0 ? summaries.join("\n\n") : undefined,
    messagesWithoutSummaries,
  };
}

function serializeMessage(message: ModelMessage): string {
  const content = typeof message.content === "string" ? message.content : safeJson(message.content);
  return `${message.role.toUpperCase()}:\n${content}`;
}

function serializeMessages(messages: ModelMessage[]): string {
  return messages.map(serializeMessage).join("\n\n---\n\n");
}

async function generateCompactionSummary(
  messagesToSummarize: ModelMessage[],
  previousSummary: string | undefined,
  model: LanguageModelV3,
): Promise<string> {
  const previousSummaryBlock = previousSummary
    ? `<existing_summary>\n${previousSummary}\n</existing_summary>\n\n`
    : "";

  const prompt = `${previousSummaryBlock}<messages_to_summarize>\n${serializeMessages(
    messagesToSummarize,
  )}\n</messages_to_summarize>\n\n${SUMMARY_PROMPT}`;

  const result = await generateText({
    model,
    system: SUMMARY_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 1600,
  });

  return result.text.trim();
}

async function compactMessages(
  messages: ModelMessage[],
  options: Required<Pick<MessageCompactionOptions, "contextWindowTokens" | "keepRecentTokens">> &
    Pick<MessageCompactionOptions, "model" | "systemPrompt">,
  tokensBefore: number,
  thresholdTokens: number,
  reserveTokens: number,
  usageEstimate: ContextUsageEstimate,
): Promise<MessageCompactionResult> {
  const { previousSummary, messagesWithoutSummaries } = extractExistingSummary(messages);
  const tailStart = findTailStart(messagesWithoutSummaries, options.keepRecentTokens);

  if (tailStart <= 0 && !previousSummary) {
    return {
      messages,
      compacted: false,
      tokensBefore,
      thresholdTokens,
      reserveTokens,
      usageEstimate,
    };
  }

  const messagesToSummarize = messagesWithoutSummaries.slice(0, tailStart);
  const recentMessages = stripInternalMessageMetadata(messagesWithoutSummaries.slice(tailStart));

  if (messagesToSummarize.length === 0 && previousSummary) {
    return {
      messages: [createCompactionSummaryMessage(previousSummary), ...recentMessages],
      compacted: true,
      tokensBefore,
      thresholdTokens,
      reserveTokens,
      usageEstimate,
    };
  }

  const model = options.model ?? createCompactionGatewayModel();
  const summary = await generateCompactionSummary(messagesToSummarize, previousSummary, model);

  return {
    messages: [createCompactionSummaryMessage(summary), ...recentMessages],
    compacted: true,
    tokensBefore,
    thresholdTokens,
    reserveTokens,
    usageEstimate,
  };
}

function resolveReserveTokens(
  contextWindowTokens: number,
  options: Pick<MessageCompactionOptions, "reserveTokens" | "threshold">,
): number {
  if (options.reserveTokens != null) return options.reserveTokens;

  if (options.threshold != null) {
    return Math.max(0, contextWindowTokens - Math.floor(contextWindowTokens * options.threshold));
  }

  return DEFAULT_COMPACTION_RESERVE_TOKENS;
}

export async function compactMessagesIfNeeded(
  messages: ModelMessage[],
  options: MessageCompactionOptions = {},
): Promise<MessageCompactionResult> {
  const contextWindowTokens = options.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
  const keepRecentTokens = options.keepRecentTokens ?? DEFAULT_KEEP_RECENT_TOKENS;
  const reserveTokens = resolveReserveTokens(contextWindowTokens, options);
  const thresholdTokens = Math.max(0, contextWindowTokens - reserveTokens);
  const usageEstimate = estimateMessagesContextUsage(messages, options.systemPrompt);
  const tokensBefore = usageEstimate.tokens;

  if (tokensBefore <= thresholdTokens) {
    return {
      messages,
      compacted: false,
      tokensBefore,
      thresholdTokens,
      reserveTokens,
      usageEstimate,
    };
  }

  try {
    return await compactMessages(
      messages,
      {
        model: options.model,
        systemPrompt: options.systemPrompt,
        contextWindowTokens,
        keepRecentTokens,
      },
      tokensBefore,
      thresholdTokens,
      reserveTokens,
      usageEstimate,
    );
  } catch (error) {
    return {
      messages,
      compacted: false,
      tokensBefore,
      thresholdTokens,
      reserveTokens,
      usageEstimate,
      error,
    };
  }
}

export function createRescueCompactionPrepareStep(options: MessageCompactionOptions = {}) {
  return async ({ messages }: { messages: ModelMessage[] }) => {
    const result = await compactMessagesIfNeeded(messages, {
      ...options,
      ...(options.reserveTokens == null && options.threshold == null
        ? { reserveTokens: RESCUE_COMPACTION_RESERVE_TOKENS }
        : {}),
    });

    return result.compacted ? { messages: result.messages } : {};
  };
}
