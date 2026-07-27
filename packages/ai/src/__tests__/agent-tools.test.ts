import { describe, expect, test } from "bun:test";
import { skintextAgentTools } from "../tools/agent-tools";

describe("Skintext agent tools", () => {
  test("uses one stable, domain-ordered tool registry", () => {
    expect(Object.keys(skintextAgentTools)).toEqual([
      "logRoutineStep",
      "deleteRoutineEntry",
      "getTodayRoutineLog",
      "getWeeklyRoutineLog",
      "saveProduct",
      "deleteProduct",
      "deleteAllProducts",
      "listProducts",
      "logProductUse",
      "updateProfile",
      "getPersonalizationSummary",
      "setReminders",
      "getReminders",
      "scheduleOneOffReminder",
      "listOneOffReminders",
      "cancelOneOffReminder",
      "startExperiment",
      "getActiveExperiment",
      "listExperiments",
      "closeExperiment",
      "sendUiMessage",
      "listUserImages",
      "sendUserImage",
      "setPhotoRetention",
      "saveCurrentPhoto",
      "deleteSavedPhotos",
      "clearConversationHistory",
      "exportData",
      "deleteAccount",
    ]);
  });
});
