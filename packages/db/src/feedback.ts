import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { userFeedback } from "./schema";

export type FeedbackKind = "request" | "issue";
export type FeedbackStatus = "new" | "reviewed" | "resolved";

export interface UserFeedbackRecord {
  id: string;
  userId: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SaveUserFeedbackInput {
  id: string;
  userId: string;
  kind: FeedbackKind;
  message: string;
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function parseFeedback(row: typeof userFeedback.$inferSelect): Promise<UserFeedbackRecord> {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind as FeedbackKind,
    message: row.message,
    status: row.status as FeedbackStatus,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
  };
}

export async function saveUserFeedback(input: SaveUserFeedbackInput): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(userFeedback)
    .values({
      ...input,
      message: input.message,
      status: "new",
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: userFeedback.id });
}

export async function getUserFeedback(feedbackId: string): Promise<UserFeedbackRecord | null> {
  const row = await getDb().query.userFeedback.findFirst({
    where: eq(userFeedback.id, feedbackId),
  });
  return row ? parseFeedback(row) : null;
}

export async function listUserFeedback(userId: string): Promise<UserFeedbackRecord[]> {
  const rows = await getDb().query.userFeedback.findMany({
    where: eq(userFeedback.userId, userId),
    orderBy: desc(userFeedback.createdAt),
  });
  return Promise.all(rows.map(parseFeedback));
}
