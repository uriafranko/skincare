import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { createPendingUserForPhone, resolveUserId } = await import("../users");

describe("users", () => {
  test("creates a pending user and resolves it by phone without a transaction", async () => {
    const userId = await createPendingUserForPhone("usr_pending", "+15555550123", {
      locale: "en",
      timezone: "America/New_York",
      country: "US",
    });

    expect(userId).toBe("usr_pending");
    expect(await resolveUserId("+15555550123")).toBe("usr_pending");
  });
});
