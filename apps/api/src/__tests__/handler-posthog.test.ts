import { beforeEach, describe, expect, mock, test } from "bun:test";

const routeError = new Error("agent unavailable");
const capturedExceptions: Array<{ error: unknown; distinctId?: string }> = [];
const sentMessages: string[] = [];
const logErrors: unknown[] = [];
let released = 0;
let emitted = 0;

mock.module("@skintext/db", () => ({
  reserveInboundMessage: async () => true,
  resolveUserId: async () => "usr_test",
  tryAcquireMessageLock: async () => async () => {
    released++;
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
  errorForLogging: (error: unknown) => error,
}));

mock.module("@/posthog", () => ({
  capturePostHogException: (error: unknown, distinctId?: string) => {
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
  });

  test("captures a swallowed route error with the database-backed user ID", async () => {
    await handleIncoming("+15555550123", "hello", undefined, "message_1");

    expect(capturedExceptions).toEqual([{ error: routeError, distinctId: "usr_test" }]);
    expect(logErrors).toEqual([routeError]);
    expect(sentMessages).toEqual(["Oops, something went wrong. Try again in a sec! 🙏"]);
    expect(released).toBe(1);
    expect(emitted).toBe(1);
  });
});
