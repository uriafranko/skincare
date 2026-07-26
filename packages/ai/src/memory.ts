import type { MastraDBMessage } from "@mastra/core/memory";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { env, generateId } from "@skintext/shared";
import { SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS, sanitizedImageUserText } from "./memory-policy";
import { getMemoryModelName } from "./models";

export const mastraStorage = new PostgresStore({
  id: "skintext-postgres",
  connectionString: env.DATABASE_URL,
  schemaName: "mastra",
  disableInit: process.env.NODE_ENV === "production",
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const skintextMemory = new Memory({
  storage: mastraStorage,
  options: {
    observationalMemory: {
      model: getMemoryModelName(),
      ...SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS,
    },
  },
});

function threadIdFor(resourceId: string): string {
  return `skintext:${resourceId}`;
}

async function ensureThread(resourceId: string): Promise<string> {
  const threadId = threadIdFor(resourceId);
  const existing = await skintextMemory.getThreadById({ threadId, resourceId });
  if (!existing) {
    const now = new Date();
    await skintextMemory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: "Skintext",
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return threadId;
}

function textMessage(input: {
  role: "user" | "assistant";
  text: string;
  threadId: string;
  resourceId: string;
  createdAt: Date;
}): MastraDBMessage {
  return {
    id: generateId("msg"),
    role: input.role,
    createdAt: input.createdAt,
    threadId: input.threadId,
    resourceId: input.resourceId,
    content: {
      format: 2,
      parts: [{ type: "text", text: input.text }],
    },
  };
}

export async function saveSanitizedImageTurn(input: {
  resourceId: string;
  userText: string;
  assistantText: string;
}): Promise<void> {
  const threadId = await ensureThread(input.resourceId);
  const createdAt = new Date();
  await skintextMemory.saveMessages({
    messages: [
      textMessage({
        role: "user",
        text: sanitizedImageUserText(input.userText),
        threadId,
        resourceId: input.resourceId,
        createdAt,
      }),
      textMessage({
        role: "assistant",
        text: input.assistantText,
        threadId,
        resourceId: input.resourceId,
        createdAt: new Date(createdAt.getTime() + 1),
      }),
    ],
  });
}

export async function exportUserMemory(resourceId: string) {
  const [threads, messages] = await Promise.all([
    skintextMemory.listThreads({
      filter: { resourceId },
      perPage: false,
    }),
    skintextMemory.listMessagesByResourceId({
      resourceId,
      perPage: false,
      orderBy: { field: "createdAt", direction: "ASC" },
    }),
  ]);

  return {
    threads: threads.threads,
    messages: messages.messages,
  };
}

export async function deleteUserMemory(resourceId: string): Promise<void> {
  const result = await skintextMemory.listThreads({
    filter: { resourceId },
    perPage: false,
  });
  await Promise.all(result.threads.map((thread) => skintextMemory.deleteThread(thread.id)));
}

export async function getUserConversationHistoryStatus(resourceId: string) {
  const messages = await skintextMemory.listMessagesByResourceId({
    resourceId,
    perPage: false,
  });
  return {
    retained: messages.messages.length > 0,
    messageCount: messages.messages.length,
  };
}
