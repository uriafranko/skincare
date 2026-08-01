import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { skintextAgentTools } from "../tools/agent-tools";

describe("Skintext agent tools", () => {
  test("uses one stable, domain-ordered tool registry", () => {
    expect(Object.keys(skintextAgentTools)).toEqual([
      "routine",
      "setTimezone",
      "setReminders",
      "getReminders",
      "scheduleOneOffReminder",
      "listOneOffReminders",
      "cancelOneOffReminder",
      "sendUiMessage",
      "listUserImages",
      "inspectUserImage",
      "sendUserImage",
      "managePhotoRetention",
      "deleteSavedPhotos",
      "recordFeedback",
      "deleteAccount",
    ]);
  });

  test("exposes gateway-compatible top-level object schemas", () => {
    for (const [name, tool] of Object.entries(skintextAgentTools)) {
      const schema = z.toJSONSchema(tool.inputSchema as z.ZodType);
      expect({ name, type: schema.type }).toEqual({ name, type: "object" });
    }
  });
});
