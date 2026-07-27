import { describe, expect, test } from "bun:test";
import { skintextAgentTools } from "../tools/agent-tools";

describe("Skintext agent tools", () => {
  test("uses one stable, domain-ordered tool registry", () => {
    expect(Object.keys(skintextAgentTools)).toEqual([
      "logRoutineStep",
      "deleteRoutineEntry",
      "getTodayRoutineLog",
      "getWeeklyRoutineLog",
      "setTimezone",
      "setReminders",
      "getReminders",
      "scheduleOneOffReminder",
      "listOneOffReminders",
      "cancelOneOffReminder",
      "sendUiMessage",
      "listUserImages",
      "sendUserImage",
      "setPhotoRetention",
      "saveCurrentPhoto",
      "deleteSavedPhotos",
      "exportData",
      "deleteAccount",
    ]);
  });
});
