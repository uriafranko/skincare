import { decrypt, encryptContent } from "@skintext/shared";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { memories } from "./schema";

export async function saveMemory(userId: string, key: string, value: string): Promise<void> {
  const enc = await encryptContent(value);
  await getDb()
    .insert(memories)
    .values({ userId, key, value: enc })
    .onConflictDoUpdate({
      target: [memories.userId, memories.key],
      set: { value: enc, updatedAt: sql`now()` },
    });
}

export async function recallAllMemories(userId: string): Promise<Record<string, string>> {
  const data = await getDb().query.memories.findMany({
    where: eq(memories.userId, userId),
  });
  const out: Record<string, string> = {};
  for (const row of data) {
    out[row.key] = await decrypt(row.value);
  }
  return out;
}

export async function recallMemory(userId: string, key: string): Promise<string | null> {
  const row = await getDb().query.memories.findFirst({
    where: and(eq(memories.userId, userId), eq(memories.key, key)),
  });
  if (!row) return null;
  return decrypt(row.value);
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  await getDb()
    .delete(memories)
    .where(and(eq(memories.userId, userId), eq(memories.key, key)));
}
