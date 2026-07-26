import { beforeEach, describe, expect, mock, test } from "bun:test";

type SavedImage = {
  id: string;
  userId: string;
  key: string;
  contentType: string;
  size: number;
  source: "inbound";
  createdAt: string;
  expiresAt: string;
};

type BlobDeletionJob = {
  key: string;
  reason: string;
  attempts: number;
  lastError: string | null;
  retryAfter: Date;
  createdAt: Date;
  updatedAt: Date;
};

const uploaded: string[] = [];
const deleted: string[] = [];
const deleteFailures = new Set<string>();
let failAllDeletes = false;
const queuedBlobDeletions: { key: string; reason: string; error?: unknown; retryAfter?: Date }[] =
  [];
const deletedBlobDeletionJobs: string[] = [];
let deletedAllUserImages: string[] = [];
let savedImages: SavedImage[] = [];
let expiredImages: SavedImage[] = [];
let allUserImages: SavedImage[] = [];
let dueBlobDeletions: BlobDeletionJob[] = [];
let saveUserImageImpl: (image: SavedImage) => Promise<void> = async (image) => {
  savedImages.push(image);
};

mock.module("files-sdk", () => ({
  Files: class {
    async upload(key: string) {
      uploaded.push(key);
    }

    async delete(key: string) {
      if (failAllDeletes || deleteFailures.has(key)) throw new Error(`delete failed: ${key}`);
      deleted.push(key);
    }

    async download() {
      return { blob: async () => new Blob(["image"], { type: "image/jpeg" }) };
    }
  },
}));

mock.module("files-sdk/vercel-blob", () => ({
  vercelBlob: () => ({}),
}));

mock.module("@skintext/shared", () => ({
  PERSONALITY_POLICY_VERSION: "personality-v1",
  PHOTO_RETENTION_CONSENT_VERSION: "2026-07-26",
  decrypt: async (s: string) => s.replace(/^enc:/, ""),
  encryptContent: async (s: string) => `enc:${s}`,
  generateId: () => "img_test",
  isValidTimeZone: () => true,
}));

mock.module("@skintext/db", () => ({
  cancelOneOffReminder: async () => null,
  createOneOffReminder: async () => {},
  deleteAllUserImages: async (userId: string) => {
    deletedAllUserImages.push(userId);
  },
  deleteBlobDeletionJob: async (key: string) => {
    deletedBlobDeletionJobs.push(key);
  },
  deleteCustomReminderTimes: async () => {},
  deleteUserImageRecord: async () => {},
  getCustomReminderTimes: async () => null,
  getOneOffReminder: async () => null,
  getUser: async () => null,
  listAllUserImages: async () => allUserImages,
  listDueBlobDeletions: async () => dueBlobDeletions,
  listExpiredUserImages: async () => expiredImages,
  listOneOffReminders: async () => [],
  markOneOffReminderFailed: async () => {},
  queueBlobDeletion: async (job: {
    key: string;
    reason: string;
    error?: unknown;
    retryAfter?: Date;
  }) => {
    queuedBlobDeletions.push(job);
  },
  saveUserImage: async (image: SavedImage) => saveUserImageImpl(image),
  setCustomReminderTimes: async () => {},
  setOneOffReminderWorkflowRunId: async () => {},
  updateUser: async () => {},
}));

mock.module("@/sendblue", () => ({
  sendImageFile: async () => {},
}));

const { deleteAllUserImageBlobs, pruneExpiredUserImageBlobs, saveInboundUserImage } = await import(
  "../user-images"
);

beforeEach(() => {
  uploaded.length = 0;
  deleted.length = 0;
  deleteFailures.clear();
  failAllDeletes = false;
  queuedBlobDeletions.length = 0;
  deletedBlobDeletionJobs.length = 0;
  deletedAllUserImages = [];
  savedImages = [];
  expiredImages = [];
  allUserImages = [];
  dueBlobDeletions = [];
  saveUserImageImpl = async (image) => {
    savedImages.push(image);
  };
});

const normalizedImage = {
  dataUrl: "data:image/jpeg;base64,aW1hZ2U=",
  buffer: Buffer.from("image"),
  contentType: "image/jpeg" as const,
  size: 5,
};

describe("user image blob storage", () => {
  test("deletes an uploaded blob when saving image metadata fails", async () => {
    saveUserImageImpl = async () => {
      throw new Error("db unavailable");
    };

    await expect(
      saveInboundUserImage({
        userId: "usr_test",
        image: normalizedImage,
        text: "my cheek today",
      }),
    ).rejects.toThrow("db unavailable");

    expect(uploaded).toHaveLength(1);
    expect(deleted).toEqual(uploaded);
    expect(queuedBlobDeletions).toEqual([]);
  });

  test("queues an uploaded blob when metadata save and rollback delete both fail", async () => {
    saveUserImageImpl = async () => {
      throw new Error("db unavailable");
    };
    failAllDeletes = true;

    await expect(
      saveInboundUserImage({
        userId: "usr_test",
        image: normalizedImage,
        text: "my cheek today",
      }),
    ).rejects.toThrow("db unavailable");

    expect(queuedBlobDeletions).toHaveLength(1);
    expect(queuedBlobDeletions[0]).toMatchObject({
      key: uploaded[0],
      reason: "user-image-save-failed",
    });
  });

  test("does not block account deletion when one image blob delete fails", async () => {
    allUserImages = [
      {
        id: "img_ok",
        userId: "usr_test",
        key: "user-images/ok.jpg",
        contentType: "image/jpeg",
        size: 1,
        source: "inbound",
        createdAt: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "img_fail",
        userId: "usr_test",
        key: "user-images/fail.jpg",
        contentType: "image/jpeg",
        size: 1,
        source: "inbound",
        createdAt: "2026-06-02T00:00:00.000Z",
        expiresAt: "2026-07-02T00:00:00.000Z",
      },
    ];
    deleteFailures.add("user-images/fail.jpg");

    const result = await deleteAllUserImageBlobs("usr_test");

    expect(result).toEqual({ attempted: 2, deleted: 1, queued: 1, errors: 1 });
    expect(deleted).toEqual(["user-images/ok.jpg"]);
    expect(queuedBlobDeletions).toHaveLength(1);
    expect(queuedBlobDeletions[0]).toMatchObject({
      key: "user-images/fail.jpg",
      reason: "account-delete",
    });
    expect(deletedAllUserImages).toEqual(["usr_test"]);
  });

  test("cron cleanup retries queued blob deletions", async () => {
    dueBlobDeletions = [
      {
        key: "user-images/queued.jpg",
        reason: "account-delete",
        attempts: 1,
        lastError: "storage unavailable",
        retryAfter: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    ];

    const result = await pruneExpiredUserImageBlobs();

    expect(result).toMatchObject({
      queuedScanned: 1,
      queuedDeleted: 1,
      queuedErrors: 0,
    });
    expect(deleted).toEqual(["user-images/queued.jpg"]);
    expect(deletedBlobDeletionJobs).toEqual(["user-images/queued.jpg"]);
  });
});
