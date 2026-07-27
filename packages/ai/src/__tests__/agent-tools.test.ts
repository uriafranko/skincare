import { describe, expect, test } from "bun:test";
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
      "deleteAccount",
    ]);
  });
});
