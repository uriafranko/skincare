import { describe, expect, mock, test } from "bun:test";
import { createFakeDb } from "./fake-db";

const fakeDb = createFakeDb();

mock.module("../client", () => ({
  getDb: () => fakeDb,
}));

const { completeUserOnboarding, createPendingUserForPhone, getUser, resolveUserId } = await import(
  "../users"
);

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

  test("uses completion as a narrow final commit marker", async () => {
    await createPendingUserForPhone("usr_complete", "+15555550124", {
      locale: "en",
      timezone: "UTC",
      country: "US",
    });

    await completeUserOnboarding("usr_complete", "2026-08-08T00:00:00.000Z", "terms-v2");

    const user = await getUser("usr_complete");
    expect(user?.onboardingComplete).toBe(true);
    expect(user?.consentedAt).toBe("2026-08-08T00:00:00.000Z");
    expect(user?.consentVersion).toBe("terms-v2");
    expect(user?.timezone).toBe("UTC");
  });
});
