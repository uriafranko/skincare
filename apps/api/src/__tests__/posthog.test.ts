import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

let constructorOptions: Record<string, unknown> | undefined;
let captureFailure: Error | null;
const capturedExceptions: Array<{ error: unknown; distinctId?: string }> = [];
const waitUntil = mock(() => undefined);

mock.module("@vercel/functions", () => ({ waitUntil }));
mock.module("posthog-node", () => ({
  PostHog: class {
    constructor(_token: string, options: Record<string, unknown>) {
      constructorOptions = options;
    }

    captureException(error: unknown, distinctId?: string) {
      if (captureFailure) throw captureFailure;
      capturedExceptions.push({ error, distinctId });
    }
  },
}));

process.env.POSTHOG_PROJECT_TOKEN = "test_project_token";
process.env.POSTHOG_HOST = "https://posthog.test";

const { capturePostHogException } = await import("../posthog");

describe("PostHog client", () => {
  beforeEach(() => {
    captureFailure = null;
    capturedExceptions.length = 0;
  });

  test("hands background delivery to the Vercel request lifecycle", () => {
    expect(constructorOptions).toMatchObject({
      flushAt: 1,
      flushInterval: 0,
      waitUntil,
    });
  });

  test("captures exceptions with an explicit user ID", () => {
    const error = new Error("route failed");

    capturePostHogException(error, "usr_test");

    expect(capturedExceptions).toEqual([{ error, distinctId: "usr_test" }]);
  });

  test("never lets an SDK enqueue failure escape into the application", () => {
    captureFailure = new Error("analytics unavailable");
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => capturePostHogException(new Error("route failed"), "usr_test")).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
