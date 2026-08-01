import { beforeEach, describe, expect, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import { saveUserFeedback } from "./db-mock";

const { recordFeedbackTool } = await import("../tools/feedback");

function execute(input: { kind: "request" | "issue"; message: string }) {
  if (!recordFeedbackTool.execute) throw new Error("Tool is not executable.");
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    agentContext: { userId: "usr_feedback" },
  });
  return recordFeedbackTool.execute(input, { requestContext } as never);
}

describe("recordFeedbackTool", () => {
  beforeEach(() => {
    saveUserFeedback.mockClear();
  });

  test("records a request against the trusted runtime user", async () => {
    const result = await execute({
      kind: "request",
      message: "I want to compare two saved photos.",
    });

    expect(saveUserFeedback).toHaveBeenCalledWith({
      id: "test_id",
      userId: "usr_feedback",
      kind: "request",
      message: "I want to compare two saved photos.",
    });
    expect(result).toEqual({ saved: true, feedbackId: "test_id" });
  });

  test("makes the product-feedback boundary explicit", () => {
    const description = (recordFeedbackTool as unknown as { description: string }).description;
    expect(description).toContain("not working");
    expect(description).toContain("Do not use this for skincare goals");
  });
});
