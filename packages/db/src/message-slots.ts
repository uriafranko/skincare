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

/**
 * Checks webhook deduplication and acquires a per-phone processing lock.
 * On "acquired", caller MUST call the returned `release` function when done.
 */
/** @param encryptedPhone deterministic ciphertext from `encrypt(phone)`, never raw E.164 */
export async function acquireMessageSlot(
  encryptedPhone: string,
  messageId?: string,
): Promise<{ status: "duplicate" | "locked" | "acquired"; release: () => Promise<void> }> {
  const lockKey = `lock:${encryptedPhone}`;
  const dedupKey = messageId ? `dedup:${messageId}` : null;

  await pruneExpiredKeys();

  const noop = async () => {};
  const dedupOk = dedupKey ? await trySetExpiringKey(dedupKey, "dedup", DEDUP_TTL) : true;
  const lockOk = await trySetExpiringKey(lockKey, "lock", LOCK_TTL);

  if (!dedupOk) {
    if (lockOk) await deleteExpiringKey(lockKey);
    return { status: "duplicate", release: noop };
  }

  if (!lockOk) {
    if (dedupKey) await deleteExpiringKey(dedupKey);
    return { status: "locked", release: noop };
  }

  return {
    status: "acquired",
    release: async () => {
      await deleteExpiringKey(lockKey);
    },
  };
}
