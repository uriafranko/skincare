import {
  deleteAllUserImages,
  deleteBlobDeletionJob,
  deleteUserImageRecord,
  listAllUserImages,
  listDueBlobDeletions,
  listExpiredUserImages,
  queueBlobDeletion,
  saveUserImage,
} from "@skintext/db";
import { generateId, type UserImage } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { Files } from "files-sdk";
import { vercelBlob } from "files-sdk/vercel-blob";
import type { NormalizedImage } from "@/image";
import { sendImageFile } from "@/sendblue";

const USER_IMAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BLOB_DELETION_RETRY_MS = 24 * 60 * 60 * 1000;

let filesClient: Files | null = null;

function getFiles(): Files {
  filesClient ??= new Files({
    adapter: vercelBlob({
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
    }),
    timeout: 15_000,
    retries: 2,
  });
  return filesClient;
}

function datePath(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function sourceText(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 500) : undefined;
}

function logStorageError(log: RequestLogger | undefined, error: unknown, key?: string): void {
  log?.error(error instanceof Error ? error : new Error(String(error)));
  log?.set({ imageStorageError: { occurred: true, hasBlobKey: !!key } });
}

function nextBlobDeletionRetry(): Date {
  return new Date(Date.now() + BLOB_DELETION_RETRY_MS);
}

async function queueFailedBlobDeletion(
  key: string,
  reason: string,
  error: unknown,
  log?: RequestLogger,
): Promise<boolean> {
  try {
    await queueBlobDeletion({
      key,
      reason,
      error,
      retryAfter: nextBlobDeletionRetry(),
    });
    return true;
  } catch (queueError) {
    logStorageError(log, queueError, key);
    return false;
  }
}

export async function saveInboundUserImage({
  userId,
  image,
  text,
  messageId,
  log,
}: {
  userId: string;
  image: NormalizedImage;
  text: string;
  messageId?: string;
  log?: RequestLogger;
}): Promise<UserImage> {
  const now = new Date();
  const id = generateId("img");
  const key = `user-images/${datePath(now)}/${id}.jpg`;
  const expiresAt = new Date(now.getTime() + USER_IMAGE_TTL_MS);
  const files = getFiles();

  try {
    await files.upload(key, image.buffer, {
      contentType: image.contentType,
    });
  } catch (error) {
    logStorageError(log, error, key);
    throw error;
  }

  const record: UserImage = {
    id,
    userId,
    key,
    contentType: image.contentType,
    size: image.size,
    source: "inbound",
    sourceMessageId: messageId,
    sourceText: sourceText(text),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    await saveUserImage(record);
  } catch (error) {
    try {
      await files.delete(key);
    } catch (deleteError) {
      await queueFailedBlobDeletion(key, "user-image-save-failed", deleteError, log);
    }
    throw error;
  }

  log?.set({ imageStorage: { retained: true, ttlDays: 30 } });
  return record;
}

export async function sendStoredUserImage({
  phone,
  image,
  caption,
}: {
  phone: string;
  image: UserImage;
  caption?: string;
}): Promise<void> {
  const stored = await getFiles().download(image.key);
  const blob = await stored.blob();
  await sendImageFile(phone, blob, `${image.id}.jpg`, caption);
}

export async function loadStoredUserImageDataUrl(image: UserImage): Promise<string> {
  const stored = await getFiles().download(image.key);
  const blob = await stored.blob();
  const contentType = blob.type || image.contentType;
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${data}`;
}

export async function pruneExpiredUserImageBlobs(log?: RequestLogger): Promise<{
  scanned: number;
  deleted: number;
  errors: number;
  queuedScanned: number;
  queuedDeleted: number;
  queuedErrors: number;
}> {
  const expired = await listExpiredUserImages(new Date(), 100);
  let deleted = 0;
  let errors = 0;

  for (const image of expired) {
    try {
      await getFiles().delete(image.key);
      await deleteUserImageRecord(image.id);
      deleted++;
    } catch (error) {
      errors++;
      logStorageError(log, error, image.key);
    }
  }

  const queued = await pruneQueuedBlobDeletions(log);
  log?.set({ imagePrune: { scanned: expired.length, deleted, errors, queued } });
  return {
    scanned: expired.length,
    deleted,
    errors,
    queuedScanned: queued.scanned,
    queuedDeleted: queued.deleted,
    queuedErrors: queued.errors,
  };
}

async function pruneQueuedBlobDeletions(log?: RequestLogger): Promise<{
  scanned: number;
  deleted: number;
  errors: number;
}> {
  const queued = await listDueBlobDeletions(new Date(), 100);
  let deleted = 0;
  let errors = 0;

  for (const job of queued) {
    try {
      await getFiles().delete(job.key);
      await deleteBlobDeletionJob(job.key);
      deleted++;
    } catch (error) {
      errors++;
      logStorageError(log, error, job.key);
      await queueFailedBlobDeletion(job.key, job.reason, error, log);
    }
  }

  return { scanned: queued.length, deleted, errors };
}

export async function deleteAllUserImageBlobs(
  userId: string,
  log?: RequestLogger,
): Promise<{ attempted: number; deleted: number; queued: number; errors: number }> {
  const images = await listAllUserImages(userId);
  let deleted = 0;
  let queued = 0;
  let errors = 0;

  for (const image of images) {
    try {
      await getFiles().delete(image.key);
      deleted++;
    } catch (error) {
      errors++;
      logStorageError(log, error, image.key);
      if (await queueFailedBlobDeletion(image.key, "account-delete", error, log)) {
        queued++;
      }
    }
  }

  await deleteAllUserImages(userId);
  log?.set({ imageDelete: { attempted: images.length, deleted, queued, errors } });
  return { attempted: images.length, deleted, queued, errors };
}
