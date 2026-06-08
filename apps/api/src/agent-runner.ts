import type {
  ModelMessage,
  RecurringReminderScheduleSync,
  ScheduleOneOffReminderWorkflow,
} from "@skintext/ai";
import {
  annotateLastAssistantMessageUsage,
  buildSkintextSystemPrompt,
  compactMessagesIfNeeded,
  createCompactionGatewayModel,
  createDefaultGatewayModel,
  createSkintextAgent,
  DEFAULT_COMPACTION_RESERVE_TOKENS,
  stripInternalMessageMetadata,
} from "@skintext/ai";
import {
  getAdherenceStreak,
  getAllProducts,
  getConversationMessages,
  recallAllMemories,
  saveConversationMessages,
} from "@skintext/db";
import type { AgentContext, UserProfile } from "@skintext/shared";
import { getLocaleName, localDateString } from "@skintext/shared";
import { pruneMessages } from "ai";
import type { RequestLogger } from "evlog";
import { createAILogger } from "evlog/ai";

export interface RunAgentMessageOptions {
  imageUrl?: string;
  hasImage?: boolean;
  scheduleOneOffReminderWorkflow?: ScheduleOneOffReminderWorkflow;
  syncRecurringReminderSchedule?: RecurringReminderScheduleSync;
}

function buildUserMessage(text: string, imageUrl?: string, hasImage?: boolean): ModelMessage {
  if (imageUrl) {
    return {
      role: "user",
      content: [
        {
          type: "text",
          text: text
            ? `${text}\n\n[User attached a skincare/product photo]`
            : "[User sent a skincare/product photo]",
        },
        { type: "image", image: imageUrl },
      ],
    };
  }

  if (hasImage) {
    return {
      role: "user",
      content: text
        ? `${text}\n\n[User attached a skincare/product photo]`
        : "[User sent a skincare/product photo]",
    };
  }

  return { role: "user", content: text };
}

// Single main-agent entrypoint for inbound user texts and scheduled reminder events.
export async function runAgentMessage(
  log: RequestLogger,
  user: UserProfile,
  text: string,
  options: RunAgentMessageOptions = {},
): Promise<string | null> {
  const userId = user.id;
  const [rawHistory, memories, streak, products] = await Promise.all([
    getConversationMessages<ModelMessage>(userId),
    recallAllMemories(userId),
    getAdherenceStreak(userId),
    getAllProducts(userId),
  ]);
  const conversationHistory = rawHistory;

  const now = new Date();
  const localDate = localDateString(user.timezone, now);

  const hasImage = options.hasImage ?? !!options.imageUrl;
  log.set({
    user: { name: user.name, locale: user.locale, timezone: user.timezone },
    context: {
      localDate,
      hasImage,
      historyLength: conversationHistory.length,
      streak: streak.current,
    },
  });

  const ctx: AgentContext = {
    userId,
    userName: user.name,
    localeName: getLocaleName(user.locale),
    locale: user.locale,
    timezone: user.timezone,
    localDate,
    userProfile: user,
    memories: Object.keys(memories).length > 0 ? memories : null,
    streak: streak.current > 0 ? streak.current : null,
    products,
    imageUrl: options.imageUrl,
  };

  const ai = createAILogger(log, { toolInputs: { maxLength: 200 } });
  const model = ai.wrap(createDefaultGatewayModel());
  const compactionModel = ai.wrap(createCompactionGatewayModel());

  const systemPrompt = buildSkintextSystemPrompt(ctx);
  const userMessage = buildUserMessage(text, options.imageUrl, hasImage);
  const agent = createSkintextAgent(systemPrompt, {
    userId,
    timezone: user.timezone,
    hasImage,
    imageUrl: options.imageUrl,
    model,
    compactionModel,
    scheduleOneOffReminderWorkflow: options.scheduleOneOffReminderWorkflow,
    syncRecurringReminderSchedule: options.syncRecurringReminderSchedule,
  });

  const allMessages: ModelMessage[] = [...conversationHistory, userMessage];
  const preRunCompaction = await compactMessagesIfNeeded(allMessages, {
    model: compactionModel,
    systemPrompt,
    reserveTokens: DEFAULT_COMPACTION_RESERVE_TOKENS,
  });

  const compactionLog = {
    phase: "pre-run",
    compacted: preRunCompaction.compacted,
    tokensBefore: preRunCompaction.tokensBefore,
    estimatedTokens: preRunCompaction.usageEstimate.estimatedTokens,
    usageTokens: preRunCompaction.usageEstimate.usageTokens,
    trailingTokens: preRunCompaction.usageEstimate.trailingTokens,
    thresholdTokens: preRunCompaction.thresholdTokens,
    reserveTokens: preRunCompaction.reserveTokens,
    imageCount: preRunCompaction.usageEstimate.imageCount,
    imageTokens: preRunCompaction.usageEstimate.imageTokens,
    imagePayloadBytes: preRunCompaction.usageEstimate.imagePayloadBytes,
    imageDataUrls: preRunCompaction.usageEstimate.imageDataUrlCount,
    imageRemoteUrls: preRunCompaction.usageEstimate.imageRemoteUrlCount,
  };

  if (preRunCompaction.error) {
    const error =
      preRunCompaction.error instanceof Error
        ? preRunCompaction.error.message
        : String(preRunCompaction.error);
    log.set({
      compaction: {
        ...compactionLog,
        compacted: false,
        error,
      },
    });
  } else {
    log.set({
      compaction: compactionLog,
    });
  }

  const baseMessages = preRunCompaction.messages;
  if (preRunCompaction.compacted) {
    await saveConversationMessages(userId, baseMessages);
  }

  const messages = pruneMessages({
    messages: stripInternalMessageMetadata(baseMessages),
    emptyMessages: "remove",
  });

  const result = await agent.generate({ messages });
  log.set({
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      cacheReadTokens: result.usage.inputTokenDetails?.cacheReadTokens,
      cacheWriteTokens: result.usage.inputTokenDetails?.cacheWriteTokens,
    },
  });

  const responseMessages = annotateLastAssistantMessageUsage(
    result.response.messages as ModelMessage[],
    result.usage,
    {
      systemPrompt,
      estimatedInputTokens: preRunCompaction.tokensBefore,
    },
  );
  const toSave = [...baseMessages, ...responseMessages];
  await saveConversationMessages(userId, toSave);

  return result.text || null;
}
