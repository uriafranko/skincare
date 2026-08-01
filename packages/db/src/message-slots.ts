import { eq, lte } from "drizzle-orm";
import { getDb } from "./client";
import { expiringKeys } from "./schema";

const LOCK_TTL = 60;
const DEDUP_TTL = 300;

async function trySetExpiringKey(key: string, kind: string, ttlSeconds: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const [row] = await getDb()
    .insert(expiringKeys)
    .values({ key, kind, expiresAt })
    .onConflictDoNothing()
    .returning({ key: expiringKeys.key });
  return !!row;
}

async function deleteExpiringKey(key: string): Promise<void> {
  await getDb().delete(expiringKeys).where(eq(expiringKeys.key, key));
}

async function pruneExpiredKeys(): Promise<void> {
  await getDb().delete(expiringKeys).where(lte(expiringKeys.expiresAt, new Date()));
}

export async function reserveInboundMessage(messageId?: string): Promise<boolean> {
  await pruneExpiredKeys();
  return messageId ? trySetExpiringKey(`dedup:${messageId}`, "dedup", DEDUP_TTL) : true;
}

/** @param phone the user's normalized E.164 phone number */
export async function tryAcquireMessageLock(phone: string): Promise<(() => Promise<void>) | null> {
  await pruneExpiredKeys();
  const lockKey = `lock:${phone}`;
  const lockOk = await trySetExpiringKey(lockKey, "lock", LOCK_TTL);
  return lockOk ? () => deleteExpiringKey(lockKey) : null;
}
