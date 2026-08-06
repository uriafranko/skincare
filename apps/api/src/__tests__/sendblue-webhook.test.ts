import { describe, expect, mock, test } from "bun:test";

const markRead = mock(async (_phone: string) => undefined);
const parseInbound = mock(() => ({
  phone: "+15555550123",
  text: "hello",
  imageUrl: undefined,
  messageId: "message-1",
}));
let releaseHandler: (() => void) | undefined;
const handleIncoming = mock(
  () =>
    new Promise<void>((resolve) => {
      releaseHandler = resolve;
    }),
);
let backgroundWork: Promise<unknown> | undefined;
const waitUntil = mock((promise: Promise<unknown>) => {
  backgroundWork = promise;
});

mock.module("@vercel/functions", () => ({ waitUntil }));
mock.module("evlog", () => ({ initLogger: () => undefined }));
mock.module("evlog/hono", () => ({
  evlog:
    () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("log", {
        error: () => undefined,
        set: () => undefined,
        emit: () => undefined,
      });
      await next();
    },
}));
mock.module("@/handler", () => ({ handleIncoming }));
mock.module("@/logging", () => ({ errorForLogging: (error: unknown) => error }));
mock.module("@/posthog", () => ({ capturePostHogException: () => undefined }));
mock.module("@/reminder-runs", () => ({
  reminderRunManager: { migrateStale: async () => ({}) },
}));
mock.module("@/sendblue", () => ({ markRead, parseInbound }));
mock.module("@/user-images", () => ({ pruneExpiredUserImageBlobs: async () => ({}) }));

const { default: app } = await import("../index");

describe("Sendblue webhook acknowledgement", () => {
  test("returns before slow message processing finishes", async () => {
    const response = await app.request(
      new Request("http://localhost/webhooks/sendblue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(markRead).toHaveBeenCalledWith("+15555550123");
    expect(handleIncoming).toHaveBeenCalledWith("+15555550123", "hello", undefined, "message-1");
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(backgroundWork).toBeDefined();

    releaseHandler?.();
    await backgroundWork;
  });
});
