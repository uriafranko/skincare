import { describe, expect, test } from "bun:test";
import { errorForLogging } from "@/logging";

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
