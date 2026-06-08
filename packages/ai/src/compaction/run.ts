import type { ModelMessage } from "ai";
import { createCompactionGatewayModel } from "../models";
import {
  DEFAULT_COMPACTION_RESERVE_TOKENS,
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  DEFAULT_KEEP_RECENT_TOKENS,
  RESCUE_COMPACTION_RESERVE_TOKENS,
} from "./constants";
import {
  createCompactionSummaryMessage,
  generateCompactionSummary,
  getSummaryText,
} from "./summary";
import { findTailStart } from "./tail";
import type {
  ContextUsageEstimate,
  MessageCompactionOptions,
  MessageCompactionResult,
} from "./types";
import { estimateMessagesContextUsage, stripInternalMessageMetadata } from "./usage";

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

async function compactMessages(
  messages: ModelMessage[],
  options: Required<Pick<MessageCompactionOptions, "keepRecentTokens">> &
    Pick<MessageCompactionOptions, "model">,
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
