import { eq, lte, sql } from "drizzle-orm";
import { getDb } from "./client";
import { exportBlobs } from "./schema";

export async function saveExportBlob(
  userId: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await deleteExpiredExportBlobs();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await getDb()
    .insert(exportBlobs)
    .values({ userId, value, expiresAt })
    .onConflictDoUpdate({
      target: exportBlobs.userId,
      set: {
        value,
        expiresAt,
        createdAt: sql`now()`,
      },
    });
}

export async function deleteExpiredExportBlobs(): Promise<void> {
  await getDb().delete(exportBlobs).where(lte(exportBlobs.expiresAt, new Date()));
}

export async function deleteExportBlob(userId: string): Promise<void> {
  await getDb().delete(exportBlobs).where(eq(exportBlobs.userId, userId));
}
