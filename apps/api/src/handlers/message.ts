import { openai } from "@ai-sdk/openai";
import type { ModelMessage } from "@skintext/ai";
import { buildSkintextSystemPrompt, createSkintextAgent } from "@skintext/ai";
import {
  getAdherenceStreak,
  getAllProducts,
  getConversationMessages,
  getRoutineLogForDate,
  recallAllMemories,
  saveConversationMessages,
} from "@skintext/db";
import type { AgentContext, UserProfile } from "@skintext/shared";
import { getLocaleName, localDateString } from "@skintext/shared";
import { pruneMessages } from "ai";
import type { RequestLogger } from "evlog";
import { createAILogger } from "evlog/ai";
import { start } from "workflow/api";
import { oneOffReminderWorkflow } from "../../workflows/one-off-reminder";

function buildUserMessage(text: string, hasImage?: boolean): ModelMessage {
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

function stripImagesFromHistory(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "user" || typeof msg.content === "string") return msg;
    if (!Array.isArray(msg.content)) return msg;

    const textParts = msg.content.filter((p) => p.type === "text");

    if (textParts.length === 0) {
      return { ...msg, content: "[sent an image]" };
    }

    return { ...msg, content: textParts };
  });
}

export async function handleMessage(
  log: RequestLogger,
  user: UserProfile,
  text: string,
  imageUrl?: string,
): Promise<string | null> {
  const userId = user.id;
  const [rawHistory, memories, streak] = await Promise.all([
    getConversationMessages<ModelMessage>(userId),
    recallAllMemories(userId),
    getAdherenceStreak(userId),
  ]);
  const conversationHistory = stripImagesFromHistory(rawHistory);

  const now = new Date();
  const localDate = localDateString(user.timezone, now);
  const [todayLog, products] = await Promise.all([
    getRoutineLogForDate(userId, localDate),
    getAllProducts(userId),
  ]);

  const hasImage = !!imageUrl;
  log.set({
    user: { name: user.name, locale: user.locale, timezone: user.timezone },
    context: {
      localDate,
      hasImage,
      historyLength: conversationHistory.length,
      todayEntries: todayLog.entryCount,
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
    todayLog: todayLog.entryCount > 0 ? todayLog : null,
    streak: streak.current > 0 ? streak.current : null,
    products,
    imageUrl,
  };

  const ai = createAILogger(log, { toolInputs: { maxLength: 200 } });
  const model = ai.wrap(openai(hasImage ? "gpt-4.1" : "gpt-4.1-mini"));

  const systemPrompt = buildSkintextSystemPrompt(ctx);
  const userMessage = buildUserMessage(text, hasImage);
  const agent = createSkintextAgent(systemPrompt, {
    userId,
    timezone: user.timezone,
    hasImage,
    imageUrl,
    model,
    scheduleOneOffReminderWorkflow: async ({ userId, reminderId }) => {
      const run = await start(oneOffReminderWorkflow, [userId, reminderId]);
      return run.runId;
    },
  });

  const allMessages: ModelMessage[] = [...conversationHistory, userMessage];
  const messages = pruneMessages({
    messages: allMessages,
    toolCalls: "before-last-2-messages",
    reasoning: "before-last-message",
    emptyMessages: "remove",
  });

  const result = await agent.generate({ messages });

  const toSave = stripImagesFromHistory(
    pruneMessages({
      messages: [
        ...conversationHistory,
        userMessage,
        ...(result.response.messages as ModelMessage[]),
      ],
      toolCalls: "before-last-2-messages",
      emptyMessages: "remove",
    }),
  );
  await saveConversationMessages(userId, toSave);

  return result.text || null;
}
