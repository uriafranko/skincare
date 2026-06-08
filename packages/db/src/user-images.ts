import type { UserImage } from "@skintext/shared";
import { decrypt, encryptContent } from "@skintext/shared";
import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "./client";
import { blobDeletionQueue, userImages } from "./schema";

export interface BlobDeletionJob {
  key: string;
  reason: string;
  attempts: number;
  lastError: string | null;
  retryAfter: Date;
  createdAt: Date;
  updatedAt: Date;
}

async function encodeUserImage(image: UserImage): Promise<string> {
  return encryptContent(JSON.stringify(image));
}

async function decodeUserImage(raw: string): Promise<UserImage> {
  return JSON.parse(await decrypt(raw)) as UserImage;
}

function isActive(image: UserImage, now = new Date()): boolean {
  return new Date(image.expiresAt).getTime() > now.getTime();
}

function newestFirst(a: UserImage, b: UserImage): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export async function saveUserImage(image: UserImage): Promise<void> {
  const value = await encodeUserImage(image);
  await getDb()
    .insert(userImages)
    .values({
      id: image.id,
      userId: image.userId,
      key: image.key,
      value,
      createdAt: image.createdAt,
      expiresAt: new Date(image.expiresAt),
    })
    .onConflictDoUpdate({
      target: userImages.id,
      set: {
        userId: image.userId,
        key: image.key,
        value,
        createdAt: image.createdAt,
        expiresAt: new Date(image.expiresAt),
        updatedAt: sql`now()`,
      },
    });
}

export async function getUserImage(userId: string, imageId: string): Promise<UserImage | null> {
  const row = await getDb().query.userImages.findFirst({
    where: and(eq(userImages.userId, userId), eq(userImages.id, imageId)),
  });
  if (!row) return null;

  const image = await decodeUserImage(row.value);
  return isActive(image) ? image : null;
}

export async function listUserImages(userId: string, limit = 8): Promise<UserImage[]> {
  const rows = await getDb().query.userImages.findMany({
    where: eq(userImages.userId, userId),
  });

  const images: UserImage[] = [];
  for (const row of rows) {
    const image = await decodeUserImage(row.value);
    if (isActive(image)) images.push(image);
  }

  return images.sort(newestFirst).slice(0, limit);
}

export async function listAllUserImages(userId: string): Promise<UserImage[]> {
  const rows = await getDb().query.userImages.findMany({
    where: eq(userImages.userId, userId),
  });

  const images: UserImage[] = [];
  for (const row of rows) images.push(await decodeUserImage(row.value));
  return images.sort(newestFirst);
}

export async function listExpiredUserImages(now = new Date(), limit = 100): Promise<UserImage[]> {
  const rows = await getDb().query.userImages.findMany({
    where: lte(userImages.expiresAt, now),
  });

  const images: UserImage[] = [];
  for (const row of rows) images.push(await decodeUserImage(row.value));
  return images
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, limit);
}

export async function deleteUserImageRecord(imageId: string): Promise<void> {
  await getDb().delete(userImages).where(eq(userImages.id, imageId));
}

export async function deleteAllUserImages(userId: string): Promise<void> {
  await getDb().delete(userImages).where(eq(userImages.userId, userId));
}

export async function queueBlobDeletion({
  key,
  reason,
  error,
  retryAfter = new Date(),
}: {
  key: string;
  reason: string;
  error?: unknown;
  retryAfter?: Date;
}): Promise<void> {
  const lastError = error instanceof Error ? error.message : error ? String(error) : null;

  await getDb()
    .insert(blobDeletionQueue)
    .values({
      key,
      reason,
      attempts: 1,
      lastError,
      retryAfter,
    })
    .onConflictDoUpdate({
      target: blobDeletionQueue.key,
      set: {
        reason,
        attempts: sql`${blobDeletionQueue.attempts} + 1`,
        lastError,
        retryAfter,
        updatedAt: sql`now()`,
      },
    });
}

export async function listDueBlobDeletions(
  now = new Date(),
  limit = 100,
): Promise<BlobDeletionJob[]> {
  const rows = await getDb().query.blobDeletionQueue.findMany({
    where: lte(blobDeletionQueue.retryAfter, now),
  });

  return rows
    .map((row) => ({
      key: String(row.key),
      reason: String(row.reason),
      attempts: Number(row.attempts ?? 0),
      lastError: row.lastError ? String(row.lastError) : null,
      retryAfter: row.retryAfter,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => a.retryAfter.getTime() - b.retryAfter.getTime())
    .slice(0, limit);
}

export async function deleteBlobDeletionJob(key: string): Promise<void> {
  await getDb().delete(blobDeletionQueue).where(eq(blobDeletionQueue.key, key));
}
