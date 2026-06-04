import type { LanguageModelV3 } from "@ai-sdk/provider";
import { env } from "@skintext/shared";
import { generateText, type ModelMessage } from "ai";
import { createCompactionGatewayModel } from "./models";

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 1_047_576;
export const PRE_RUN_COMPACTION_THRESHOLD = 0.7;
export const RESCUE_COMPACTION_THRESHOLD = 0.8;
export const DEFAULT_KEEP_RECENT_TOKENS = 20_000;
export const DEFAULT_COMPACTION_MODEL = "openai/gpt-5.4-nano";

const SUMMARY_MARKER = "[Skintext conversation summary]";
const ESTIMATED_IMAGE_TOKENS = 1_200;

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
  threshold?: number;
  contextWindowTokens?: number;
  keepRecentTokens?: number;
}

export interface MessageCompactionResult {
  messages: ModelMessage[];
  compacted: boolean;
  tokensBefore: number;
  thresholdTokens: number;
  error?: unknown;
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

function estimateContentTokens(content: unknown): number {
  if (typeof content === "string") return estimateTextTokens(content);
  if (!Array.isArray(content)) return estimateTextTokens(safeJson(content));

  let tokens = 0;
  for (const part of content as Array<Record<string, unknown>>) {
    if (part.type === "text" && typeof part.text === "string") {
      tokens += estimateTextTokens(part.text);
      continue;
    }

    if (part.type === "image" || part.type === "file") {
      tokens += ESTIMATED_IMAGE_TOKENS;
      continue;
    }

    tokens += estimateTextTokens(safeJson(part));
  }
  return tokens;
}

export function estimateMessageTokens(message: ModelMessage): number {
  return 4 + estimateTextTokens(message.role) + estimateContentTokens(message.content);
}

export function estimateMessagesTokens(messages: ModelMessage[], systemPrompt?: string): number {
  const systemTokens = systemPrompt ? estimateTextTokens(systemPrompt) : 0;
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), systemTokens);
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

  for (let i = candidate; i < messages.length; i++) {
    if (messages[i]?.role === "user") return i;
  }

  return candidate;
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
    Pick<MessageCompactionOptions, "model" | "systemPrompt" | "threshold">,
  tokensBefore: number,
  thresholdTokens: number,
): Promise<MessageCompactionResult> {
  const { previousSummary, messagesWithoutSummaries } = extractExistingSummary(messages);
  const tailStart = findTailStart(messagesWithoutSummaries, options.keepRecentTokens);

  if (tailStart <= 0 && !previousSummary) {
    return { messages, compacted: false, tokensBefore, thresholdTokens };
  }

  const messagesToSummarize = messagesWithoutSummaries.slice(0, tailStart);
  const recentMessages = messagesWithoutSummaries.slice(tailStart);

  if (messagesToSummarize.length === 0 && previousSummary) {
    return {
      messages: [createCompactionSummaryMessage(previousSummary), ...recentMessages],
      compacted: true,
      tokensBefore,
      thresholdTokens,
    };
  }

  const model = options.model ?? createCompactionGatewayModel();
  const summary = await generateCompactionSummary(messagesToSummarize, previousSummary, model);

  return {
    messages: [createCompactionSummaryMessage(summary), ...recentMessages],
    compacted: true,
    tokensBefore,
    thresholdTokens,
  };
}

export async function compactMessagesIfNeeded(
  messages: ModelMessage[],
  options: MessageCompactionOptions = {},
): Promise<MessageCompactionResult> {
  const contextWindowTokens = options.contextWindowTokens ?? DEFAULT_CONTEXT_WINDOW_TOKENS;
  const keepRecentTokens = options.keepRecentTokens ?? DEFAULT_KEEP_RECENT_TOKENS;
  const threshold = options.threshold ?? PRE_RUN_COMPACTION_THRESHOLD;
  const thresholdTokens = Math.floor(contextWindowTokens * threshold);
  const tokensBefore = estimateMessagesTokens(messages, options.systemPrompt);

  if (tokensBefore <= thresholdTokens) {
    return { messages, compacted: false, tokensBefore, thresholdTokens };
  }

  try {
    return await compactMessages(
      messages,
      {
        model: options.model,
        systemPrompt: options.systemPrompt,
        threshold,
        contextWindowTokens,
        keepRecentTokens,
      },
      tokensBefore,
      thresholdTokens,
    );
  } catch (error) {
    return { messages, compacted: false, tokensBefore, thresholdTokens, error };
  }
}

export function createRescueCompactionPrepareStep(options: MessageCompactionOptions = {}) {
  return async ({ messages }: { messages: ModelMessage[] }) => {
    const result = await compactMessagesIfNeeded(messages, {
      ...options,
      threshold: options.threshold ?? RESCUE_COMPACTION_THRESHOLD,
    });

    return result.compacted ? { messages: result.messages } : {};
  };
}
