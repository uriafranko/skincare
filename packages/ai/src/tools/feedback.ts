import { createTool } from "@mastra/core/tools";
import { saveUserFeedback } from "@skintext/db";
import { generateId } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

export const recordFeedbackTool = createTool({
  id: "record-feedback",
  description:
    "Save explicit product feedback about Lily or the service: a requested capability or behavior, a complaint about the experience, or something in the service that is not working. Do not use this for skincare goals, skin or product reactions, or ordinary requests Lily can already perform.",
  inputSchema: z.object({
    kind: z
      .enum(["request", "issue"])
      .describe("Use request for something the user wants and issue for something not working."),
    message: z
      .string()
      .trim()
      .min(1)
      .max(2_000)
      .describe(
        "A faithful, self-contained summary of the user's explicit feedback in the user's language. Omit unrelated sensitive details.",
      ),
  }),
  outputSchema: z.object({
    saved: z.literal(true),
    feedbackId: z.string(),
  }),
  execute: async ({ kind, message }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const feedbackId = generateId("feedback");
    await saveUserFeedback({
      id: feedbackId,
      userId: runtime.agentContext.userId,
      kind,
      message,
    });
    return { saved: true as const, feedbackId };
  },
});
