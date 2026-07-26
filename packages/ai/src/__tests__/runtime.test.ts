import { describe, expect, test } from "bun:test";
import { createSkintextRequestContext, skintextMemoryOptions } from "../runtime";

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

  test("uses the same persistent user thread for live and scheduled agent prompts", () => {
    const liveScope = skintextMemoryOptions("usr_test");
    const scheduledScope = skintextMemoryOptions("usr_test");

    expect(liveScope).toEqual({
      thread: "skintext:usr_test",
      resource: "usr_test",
    });
    expect(scheduledScope).toEqual(liveScope);
  });

  test("keeps image turns on the same thread without persisting raw image messages", () => {
    expect(skintextMemoryOptions("usr_test", true)).toEqual({
      thread: "skintext:usr_test",
      resource: "usr_test",
      options: { readOnly: true },
    });
  });
});
