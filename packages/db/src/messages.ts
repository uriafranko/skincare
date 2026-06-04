import { decrypt, encryptContent } from "@skintext/shared";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { conversationMessages } from "./schema";

const MAX_CONVERSATION_MESSAGES = 40;

export async function saveConversationMessages(userId: string, messages: unknown[]): Promise<void> {
  const json = JSON.stringify(messages.slice(-MAX_CONVERSATION_MESSAGES));
  const encrypted = await encryptContent(json);
  await getDb()
    .insert(conversationMessages)
    .values({ userId, value: encrypted })
    .onConflictDoUpdate({
      target: conversationMessages.userId,
      set: { value: encrypted, updatedAt: sql`now()` },
    });
}

export async function getConversationMessages<T = unknown>(userId: string): Promise<T[]> {
  const row = await getDb().query.conversationMessages.findFirst({
    where: eq(conversationMessages.userId, userId),
  });
  if (!row) return [];
  const decrypted = await decrypt(row.value);
  return JSON.parse(decrypted) as T[];
}

export async function deleteAllMessages(userId: string): Promise<void> {
  await getDb().delete(conversationMessages).where(eq(conversationMessages.userId, userId));
}
