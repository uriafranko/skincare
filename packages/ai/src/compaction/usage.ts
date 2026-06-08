import type { LanguageModelUsage, ModelMessage } from "ai";
import { ESTIMATED_IMAGE_TOKENS, INTERNAL_METADATA_KEY } from "./constants";
import type {
  ContentUsageEstimate,
  ContextUsageEstimate,
  PersistedMessageUsage,
  SkintextMessageMetadata,
  StoredModelMessage,
} from "./types";

export function safeJson(value: unknown): string {
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
