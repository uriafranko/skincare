import { decrypt } from "@skintext/shared";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { getDb } from "./client";
import { conversationMessages } from "./schema";

export interface ConversationMessageRecord<T = unknown> {
  userId: string;
  value: T;
  createdAt: Date;
  compactedAt: Date | null;
  updatedAt: Date;
}

let lastReservedCreatedAtMs = 0;

async function decodeStoredValue(value: unknown): Promise<unknown> {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return JSON.parse(await decrypt(value)) as unknown;
  }
}

function reserveCreatedAtRange(count: number, firstCreatedAt?: Date): Date[] {
  if (count <= 0) return [];
  const firstCreatedAtMs =
    firstCreatedAt?.getTime() ?? Math.max(Date.now(), lastReservedCreatedAtMs + 1);
  lastReservedCreatedAtMs = Math.max(lastReservedCreatedAtMs, firstCreatedAtMs + count - 1);
  return Array.from({ length: count }, (_, offset) => new Date(firstCreatedAtMs + offset));
}

async function decodeConversationRows<T>(
  rows: (typeof conversationMessages.$inferSelect)[],
): Promise<ConversationMessageRecord<T>[]> {
  const messages: ConversationMessageRecord<T>[] = [];

  for (const row of rows) {
    const decoded = await decodeStoredValue(row.value);
    const base = {
      userId: row.userId,
      createdAt: row.createdAt,
      compactedAt: row.compactedAt,
      updatedAt: row.updatedAt,
    };

    if (Array.isArray(decoded)) {
      messages.push(
        ...(decoded as T[]).map((value) => ({
          ...base,
          value,
        })),
      );
      continue;
    }

    messages.push({ ...base, value: decoded as T });
  }

  return messages;
}

export async function appendConversationMessages<T = unknown>(
  userId: string,
  messages: T[],
  options: { firstCreatedAt?: Date } = {},
): Promise<ConversationMessageRecord<T>[]> {
  if (messages.length === 0) return [];

  const db = getDb();
  const createdAts = reserveCreatedAtRange(messages.length, options.firstCreatedAt);

  const rows = messages.map((message, offset) => ({
    userId,
    value: message,
    createdAt: createdAts[offset]!,
    compactedAt: null,
  }));

  for (const row of rows) {
    await db
      .insert(conversationMessages)
      .values(row)
      .returning({ createdAt: conversationMessages.createdAt });
  }

  return rows.map((row) => ({
    ...row,
    compactedAt: null,
    updatedAt: row.createdAt,
  }));
}

export async function compactConversationMessages(
  userId: string,
  compactThroughCreatedAt: Date,
  summaryMessage: unknown,
): Promise<void> {
  const compactedAt = new Date();

  await getDb()
    .update(conversationMessages)
    .set({ compactedAt, updatedAt: compactedAt })
    .where(
      and(
        eq(conversationMessages.userId, userId),
        isNull(conversationMessages.compactedAt),
        lte(conversationMessages.createdAt, compactThroughCreatedAt),
      ),
    );

  await appendConversationMessages(userId, [summaryMessage], {
    firstCreatedAt: compactThroughCreatedAt,
  });
}

export async function getConversationMessageRecords<T = unknown>(
  userId: string,
): Promise<ConversationMessageRecord<T>[]> {
  const rows = await getDb().query.conversationMessages.findMany({
    where: and(eq(conversationMessages.userId, userId), isNull(conversationMessages.compactedAt)),
    orderBy: asc(conversationMessages.createdAt),
  });
  return decodeConversationRows<T>(rows);
}

export async function getAllConversationMessageRecords<T = unknown>(
  userId: string,
): Promise<ConversationMessageRecord<T>[]> {
  const rows = await getDb().query.conversationMessages.findMany({
    where: eq(conversationMessages.userId, userId),
    orderBy: asc(conversationMessages.createdAt),
  });
  return decodeConversationRows<T>(rows);
}

export async function getConversationMessages<T = unknown>(userId: string): Promise<T[]> {
  const records = await getConversationMessageRecords<T>(userId);
  return records.map((record) => record.value);
}

export async function getAllConversationMessages<T = unknown>(userId: string): Promise<T[]> {
  const records = await getAllConversationMessageRecords<T>(userId);
  return records.map((record) => record.value);
}

export async function deleteAllMessages(userId: string): Promise<void> {
  await getDb().delete(conversationMessages).where(eq(conversationMessages.userId, userId));
}
