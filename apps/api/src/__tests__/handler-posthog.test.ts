import { beforeEach, describe, expect, mock, test } from "bun:test";

const routeError = new Error("agent unavailable");
const capturedExceptions: Array<{ error: unknown; distinctId?: string }> = [];
const sentMessages: string[] = [];
const logErrors: unknown[] = [];
let released = 0;
let emitted = 0;
let reservationError: Error | undefined;
let lockError: Error | undefined;

mock.module("@skintext/db", () => ({
  reserveInboundMessage: async () => {
    if (reservationError) throw reservationError;
    return true;
  },
  resolveUserId: async () => "usr_test",
  tryAcquireMessageLock: async () => {
    if (lockError) throw lockError;
    return async () => {
      released++;
    };
  },
}));

mock.module("evlog", () => ({
  createLogger: () => ({
    error: (error: unknown) => logErrors.push(error),
    set: () => undefined,
    emit: () => {
      emitted++;
    },
  }),
}));

mock.module("@/logging", () => ({
  reportError: (log: { error(error: unknown): void }, error: unknown, distinctId?: string) => {
    log.error(error);
    capturedExceptions.push({ error, distinctId });
  },
}));

mock.module("@/replies", () => ({
  sendReplyBubbles: async () => 1,
}));

mock.module("@/router", () => ({
  routeConcurrentMessage: async () => undefined,
  routeMessage: async () => {
    throw routeError;
  },
}));

mock.module("@/sendblue", () => ({
  sendMessage: async (_phone: string, message: string) => {
    sentMessages.push(message);
  },
  sendTyping: async () => undefined,
}));

const { handleIncoming } = await import("../handler");

describe("incoming message exception tracking", () => {
  beforeEach(() => {
    capturedExceptions.length = 0;
    sentMessages.length = 0;
    logErrors.length = 0;
    released = 0;
    emitted = 0;
    reservationError = undefined;
    lockError = undefined;
  });

  test("captures a swallowed route error with the database-backed user ID", async () => {
    await handleIncoming("+15555550123", "hello", undefined, "message_1");

    expect(capturedExceptions).toEqual([{ error: routeError, distinctId: "usr_test" }]);
    expect(logErrors).toEqual([routeError]);
    expect(sentMessages).toEqual(["I hit a snag with that. Could you send it once more?"]);
    expect(released).toBe(1);
    expect(emitted).toBe(1);
  });

  test("handles and emits when inbound reservation fails", async () => {
    reservationError = new Error("reservation unavailable");

    await handleIncoming("+15555550123", "hello", undefined, "message_1");

    expect(capturedExceptions).toEqual([{ error: reservationError, distinctId: "usr_test" }]);
    expect(sentMessages).toEqual(["I hit a snag with that. Could you send it once more?"]);
    expect(released).toBe(0);
    expect(emitted).toBe(1);
  });

  test("handles and emits when initial lock acquisition fails", async () => {
    lockError = new Error("lock unavailable");

    await handleIncoming("+15555550123", "hello", undefined, "message_1");

    expect(capturedExceptions).toEqual([{ error: lockError, distinctId: "usr_test" }]);
    expect(sentMessages).toEqual(["I hit a snag with that. Could you send it once more?"]);
    expect(released).toBe(0);
    expect(emitted).toBe(1);
  });
});
