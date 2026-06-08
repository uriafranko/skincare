import { decrypt } from "@skintext/shared";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { conversationMessages } from "./schema";

async function decodeStoredValue(value: unknown): Promise<unknown> {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return JSON.parse(await decrypt(value)) as unknown;
  }
}

export async function saveConversationMessages(userId: string, messages: unknown[]): Promise<void> {
  const rows = messages.map((message, messageIndex) => ({
    userId,
    messageIndex,
    value: message,
  }));

  const db = getDb();
  const deleteQuery = db
    .delete(conversationMessages)
    .where(eq(conversationMessages.userId, userId));

  if (rows.length === 0) {
    await deleteQuery;
    return;
  }

  await db.batch([
    deleteQuery,
    db
      .insert(conversationMessages)
      .values(rows)
      .returning({ messageIndex: conversationMessages.messageIndex }),
  ]);
}

export async function getConversationMessages<T = unknown>(userId: string): Promise<T[]> {
  const rows = await getDb().query.conversationMessages.findMany({
    where: eq(conversationMessages.userId, userId),
    orderBy: asc(conversationMessages.messageIndex),
  });
  if (rows.length === 0) return [];

  const messages: T[] = [];
  for (const row of rows) {
    const decoded = await decodeStoredValue(row.value);
    if (rows.length === 1 && row.messageIndex === 0 && Array.isArray(decoded)) {
      return decoded as T[];
    }
    messages.push(decoded as T);
  }

  return messages;
}

export async function deleteAllMessages(userId: string): Promise<void> {
  await getDb().delete(conversationMessages).where(eq(conversationMessages.userId, userId));
}
