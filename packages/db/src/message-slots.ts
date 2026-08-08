import { randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { getDb } from "./client";
import { expiringKeys } from "./schema";

const LOCK_TTL = 60;
const DEDUP_TTL = 300;

async function trySetExpiringKey(
  key: string,
  kind: string,
  ttlSeconds: number,
  ownerToken?: string,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const [row] = await getDb()
    .insert(expiringKeys)
    .values({ key, kind, ownerToken, expiresAt })
    .onConflictDoNothing()
    .returning({ key: expiringKeys.key });
  return !!row;
}

async function releaseExpiringKey(key: string, ownerToken: string): Promise<void> {
  await getDb()
    .delete(expiringKeys)
    .where(and(eq(expiringKeys.key, key), eq(expiringKeys.ownerToken, ownerToken)));
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
  const ownerToken = randomUUID();
  const lockOk = await trySetExpiringKey(lockKey, "lock", LOCK_TTL, ownerToken);
  return lockOk ? () => releaseExpiringKey(lockKey, ownerToken) : null;
}
