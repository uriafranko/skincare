import { createTool } from "@mastra/core/tools";
import { deleteAllUserData } from "@skintext/db";
import { z } from "zod";
import { deleteUserMemory } from "../memory";
import { getSkintextRuntime } from "../runtime";

export const deleteAccountTool = createTool({
  id: "delete-account",
  description:
    "Permanently delete the account and all associated data. This tool uses Mastra's native suspend/resume confirmation before deletion.",
  inputSchema: z.object({}),
  suspendSchema: z.object({
    message: z.string(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean().describe("Whether the user explicitly confirmed account deletion."),
  }),
  execute: async (_input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const warning =
      "This will permanently delete ALL your data including routine history, saved photos, retained agent memory, and preferences. This cannot be undone. Reply 'yes, delete everything' to confirm.";
    const resumeData = context.agent?.resumeData;
    if (!resumeData) {
      if (context.agent) {
        return await context.agent.suspend({ message: warning });
      }
      return { deleted: false, warning };
    }
    if (!resumeData.confirmed) {
      return { deleted: false, message: "Your account was not deleted." };
    }

    const { deleteAccountData } = runtime;
    const { userId } = runtime.agentContext;
    await (deleteAccountData ?? deleteAllUserData)(userId);
    await deleteUserMemory(userId);
    runtime.accountDeleted = true;
    return {
      deleted: true,
      message:
        "All your data has been permanently deleted. If you message me again, we'll start fresh with a new setup.",
    };
  },
});
