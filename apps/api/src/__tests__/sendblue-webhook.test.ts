import { beforeEach, describe, expect, mock, test } from "bun:test";

const markRead = mock(async (_phone: string) => undefined);
let typingError: Error | undefined;
const sendTyping = mock(async (_phone: string) => {
  if (typingError) throw typingError;
});
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
const backgroundErrors: unknown[] = [];
let backgroundEmits = 0;
let imagePrunes = 0;
let reminderMigrations = 0;
const waitUntil = mock((promise: Promise<unknown>) => {
  backgroundWork = promise;
});

mock.module("@vercel/functions", () => ({ waitUntil }));
mock.module("evlog", () => ({
  createLogger: () => ({
    error: (error: unknown) => backgroundErrors.push(error),
    emit: () => {
      backgroundEmits++;
    },
  }),
  initLogger: () => undefined,
}));
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
mock.module("@/logging", () => ({
  reportError: (log: { error(error: unknown): void }, error: unknown) => log.error(error),
}));
mock.module("@/reminder-runs", () => ({
  reminderRunManager: {
    migrateStale: async () => {
      reminderMigrations++;
      return {};
    },
  },
}));
mock.module("@/sendblue", () => ({ markRead, parseInbound, sendTyping }));
mock.module("@/user-images", () => ({
  pruneExpiredUserImageBlobs: async () => {
    imagePrunes++;
    return {};
  },
}));

const { default: app } = await import("../index");
const { env } = await import("@skintext/shared");

describe("Sendblue webhook acknowledgement", () => {
  beforeEach(() => {
    typingError = undefined;
    backgroundWork = undefined;
    backgroundErrors.length = 0;
    backgroundEmits = 0;
    imagePrunes = 0;
    reminderMigrations = 0;
    (env as { CRON_SECRET?: string }).CRON_SECRET = undefined;
  });

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
    expect(sendTyping).toHaveBeenCalledWith("+15555550123");
    expect(markRead).toHaveBeenCalledWith("+15555550123");
    expect(handleIncoming).toHaveBeenCalledWith("+15555550123", "hello", undefined, "message-1");
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(backgroundWork).toBeDefined();

    releaseHandler?.();
    await backgroundWork;
    expect(backgroundErrors).toEqual([]);
    expect(backgroundEmits).toBe(1);
  });

  test("records background failures after acknowledging the webhook", async () => {
    typingError = new Error("typing unavailable");

    const response = await app.request(
      new Request("http://localhost/webhooks/sendblue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    releaseHandler?.();
    await backgroundWork;
    expect(backgroundErrors).toEqual([typingError]);
    expect(backgroundEmits).toBe(1);
  });

  test("applies shared authorization to every cron route", async () => {
    (env as { CRON_SECRET?: string }).CRON_SECRET = "cron-test";

    for (const path of ["/cron/prune-images", "/cron/migrate-reminder-runs"]) {
      const unauthorized = await app.request(`http://localhost${path}`);
      expect(unauthorized.status).toBe(401);

      const authorized = await app.request(`http://localhost${path}`, {
        headers: { Authorization: "Bearer cron-test" },
      });
      expect(authorized.status).toBe(200);
    }

    expect(imagePrunes).toBe(1);
    expect(reminderMigrations).toBe(1);
  });
});
