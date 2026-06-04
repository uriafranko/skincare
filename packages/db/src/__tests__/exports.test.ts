import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { saveExportBlob } = await import("../exports");
const { exportBlobs } = await import("../schema");

describe("export blobs", () => {
  test("opportunistically deletes expired blobs before saving a new export", async () => {
    await saveExportBlob("usr_expired", "old", -1);
    expect(fakeDb.rows(exportBlobs)).toHaveLength(1);

    await saveExportBlob("usr_active", "new", 86400);

    const rows = fakeDb.rows(exportBlobs);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe("usr_active");
  });
});
