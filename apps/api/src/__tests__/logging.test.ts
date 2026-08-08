import { beforeEach, describe, expect, mock, test } from "bun:test";

const capturedExceptions: Array<{ error: unknown; distinctId?: string }> = [];

mock.module("@/posthog", () => ({
  capturePostHogException: (error: unknown, distinctId?: string) => {
    capturedExceptions.push({ error, distinctId });
  },
}));

const { errorForLogging, reportError } = await import("@/logging");

describe("errorForLogging", () => {
  test("keeps useful error details without provider request data", () => {
    const source = new Error("Gateway request failed", {
      cause: { requestBodyValues: { prompt: "private conversation" } },
    });
    Object.assign(source, { responseBody: "provider details" });

    const result = errorForLogging(source);

    expect(result.name).toBe("Error");
    expect(result.message).toBe("Gateway request failed");
    expect(result.stack).toBe(source.stack);
    expect(result.cause).toBeUndefined();
    expect(Object.keys(result)).toEqual([]);
  });
});

describe("reportError", () => {
  beforeEach(() => {
    capturedExceptions.length = 0;
  });

  test("sends the same sanitized error to the request log and PostHog", () => {
    const loggedErrors: unknown[] = [];
    const source = new Error("Gateway request failed", {
      cause: { requestBodyValues: { prompt: "private conversation" } },
    });
    Object.assign(source, { responseBody: "provider details" });

    reportError({ error: (error) => loggedErrors.push(error) }, source, "usr_test");

    expect(loggedErrors).toHaveLength(1);
    const safeError = loggedErrors[0] as Error;
    expect(safeError).not.toBe(source);
    expect(safeError.message).toBe(source.message);
    expect(safeError.stack).toBe(source.stack);
    expect(safeError.cause).toBeUndefined();
    expect(Object.keys(safeError)).toEqual([]);
    expect(capturedExceptions).toEqual([{ error: safeError, distinctId: "usr_test" }]);
  });

  test("never throws when a reporting sink fails", () => {
    const source = new Error("route failed");

    expect(() =>
      reportError(
        {
          error: () => {
            throw new Error("logger unavailable");
          },
        },
        source,
      ),
    ).not.toThrow();
    expect(capturedExceptions).toHaveLength(1);
    expect(capturedExceptions[0]?.error).not.toBe(source);
  });
});
