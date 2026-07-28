import type { MastraDBMessage } from "@mastra/core/memory";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { env, generateId, type UserImage } from "@skintext/shared";
import { SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS, sanitizedImageUserText } from "./memory-policy";
import { getMemoryModelName } from "./models";
import { skintextThreadId } from "./runtime";
import { type SkintextWorkingMemory, skintextWorkingMemorySchema } from "./working-memory";

export const SKINTEXT_WORKING_MEMORY_OPTIONS = {
  enabled: true,
  scope: "resource" as const,
  schema: skintextWorkingMemorySchema,
  useStateSignals: true,
};

export const mastraStorage = new PostgresStore({
  id: "skintext-postgres",
  connectionString: env.DATABASE_URL,
  schemaName: "mastra",
  disableInit: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test",
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const skintextMemory = new Memory({
  storage: mastraStorage,
  options: {
    workingMemory: SKINTEXT_WORKING_MEMORY_OPTIONS,
    observationalMemory: {
      model: getMemoryModelName(),
      ...SKINTEXT_OBSERVATIONAL_MEMORY_OPTIONS,
    },
  },
});

async function ensureThread(resourceId: string): Promise<string> {
  const threadId = skintextThreadId(resourceId);
  const existing = await skintextMemory.getThreadById({ threadId, resourceId });
  if (!existing) {
    await skintextMemory.createThread({ threadId, resourceId, title: "Zoey" });
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

function parseWorkingMemory(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export async function saveSanitizedImageTurn(input: {
  resourceId: string;
  userText: string;
  assistantText: string;
  retainedPhoto?: Pick<UserImage, "id" | "expiresAt">;
}): Promise<void> {
  const threadId = await ensureThread(input.resourceId);
  const createdAt = new Date();
  await skintextMemory.saveMessages({
    messages: [
      textMessage({
        role: "user",
        text: sanitizedImageUserText(input.userText, input.retainedPhoto),
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
  const [threads, messages, workingMemory] = await Promise.all([
    skintextMemory.listThreads({
      filter: { resourceId },
      perPage: false,
    }),
    skintextMemory.listMessagesByResourceId({
      resourceId,
      perPage: false,
      orderBy: { field: "createdAt", direction: "ASC" },
    }),
    skintextMemory.getWorkingMemory({
      threadId: skintextThreadId(resourceId),
      resourceId,
    }),
  ]);

  return {
    threads: threads.threads,
    messages: messages.messages,
    workingMemory: parseWorkingMemory(workingMemory),
  };
}

export async function deleteUserMemory(resourceId: string): Promise<void> {
  await skintextMemory.updateWorkingMemory({
    threadId: skintextThreadId(resourceId),
    resourceId,
    workingMemory: "",
  });
  const result = await skintextMemory.listThreads({
    filter: { resourceId },
    perPage: false,
  });
  await Promise.all(result.threads.map((thread) => skintextMemory.deleteThread(thread.id)));
}

export async function initializeUserWorkingMemory(
  resourceId: string,
  workingMemory: SkintextWorkingMemory,
): Promise<void> {
  await skintextMemory.updateWorkingMemory({
    threadId: skintextThreadId(resourceId),
    resourceId,
    workingMemory: JSON.stringify(workingMemory),
  });
}
