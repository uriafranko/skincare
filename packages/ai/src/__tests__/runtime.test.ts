import { describe, expect, test } from "bun:test";
import { createSkintextRequestContext } from "../runtime";

describe("Skintext request context", () => {
  test("pins Mastra memory scope to the authenticated user", () => {
    const requestContext = createSkintextRequestContext({
      userId: "usr_test",
      timezone: "UTC",
      inputText: "hello",
      hasImage: false,
      isScheduledEvent: false,
      agentContext: {} as never,
    });

    expect(requestContext.get("mastra__resourceId") as string).toBe("usr_test");
    expect(requestContext.get("mastra__threadId") as string).toBe("skintext:usr_test");
  });
});
