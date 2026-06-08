import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";
import { createSharedMock } from "./shared-mock";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

mock.module("@skintext/shared", () => createSharedMock());

const {
  deleteBlobDeletionJob,
  deleteUserImageRecord,
  getUserImage,
  listDueBlobDeletions,
  listExpiredUserImages,
  listUserImages,
  queueBlobDeletion,
  saveUserImage,
} = await import("../user-images");
const { blobDeletionQueue, userImages } = await import("../schema");

describe("user images", () => {
  test("stores active images and lists newest first", async () => {
    await saveUserImage({
      id: "img_old",
      userId: "usr_test",
      key: "user-images/old.jpg",
      contentType: "image/jpeg",
      size: 123,
      source: "inbound",
      sourceText: "old photo",
      createdAt: "2099-01-01T00:00:00.000Z",
      expiresAt: "2099-02-01T00:00:00.000Z",
    });
    await saveUserImage({
      id: "img_new",
      userId: "usr_test",
      key: "user-images/new.jpg",
      contentType: "image/jpeg",
      size: 456,
      source: "inbound",
      sourceText: "new photo",
      createdAt: "2099-01-02T00:00:00.000Z",
      expiresAt: "2099-02-02T00:00:00.000Z",
    });

    const images = await listUserImages("usr_test");

    expect(images.map((image) => image.id)).toEqual(["img_new", "img_old"]);
    expect(await getUserImage("usr_test", "img_new")).toMatchObject({ id: "img_new" });
  });

  test("excludes expired images from user lookup and exposes them for cleanup", async () => {
    await saveUserImage({
      id: "img_expired",
      userId: "usr_test",
      key: "user-images/expired.jpg",
      contentType: "image/jpeg",
      size: 789,
      source: "inbound",
      createdAt: "2000-01-01T00:00:00.000Z",
      expiresAt: "2000-02-01T00:00:00.000Z",
    });

    expect(await getUserImage("usr_test", "img_expired")).toBeNull();

    const expired = await listExpiredUserImages(new Date("2000-03-01T00:00:00.000Z"));
    expect(expired.map((image) => image.id)).toContain("img_expired");

    await deleteUserImageRecord("img_expired");
    expect(fakeDb.rows(userImages).some((row) => row.id === "img_expired")).toBe(false);
  });

  test("queues orphaned blobs for later deletion", async () => {
    await queueBlobDeletion({
      key: "user-images/orphaned.jpg",
      reason: "account-delete",
      error: new Error("storage unavailable"),
      retryAfter: new Date("2099-01-01T00:00:00.000Z"),
    });

    const dueBeforeRetry = await listDueBlobDeletions(new Date("2098-12-31T00:00:00.000Z"));
    expect(dueBeforeRetry).toEqual([]);

    const due = await listDueBlobDeletions(new Date("2099-01-02T00:00:00.000Z"));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      key: "user-images/orphaned.jpg",
      reason: "account-delete",
      attempts: 1,
      lastError: "storage unavailable",
    });

    await deleteBlobDeletionJob("user-images/orphaned.jpg");
    expect(fakeDb.rows(blobDeletionQueue)).toEqual([]);
  });
});
