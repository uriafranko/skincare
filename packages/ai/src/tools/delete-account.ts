import { createTool } from "@mastra/core/tools";
import { deleteAllUserData } from "@skintext/db";
import { z } from "zod";
import { deleteUserMemory } from "../memory";
import { getSkintextRuntime } from "../runtime";

export const deleteAccountTool = createTool({
  id: "delete-account",
  description:
    "Delete a user's account and ALL associated data permanently. Always call with confirmed=false first to warn the user, then with confirmed=true only after explicit confirmation.",
  inputSchema: z.object({
    confirmed: z.boolean().describe("false = show warning, true = actually delete"),
  }),
  execute: async ({ confirmed }, context) => {
    if (!confirmed) {
      return {
        deleted: false,
        warning:
          "This will permanently delete ALL your data including routine history, saved products, saved photos, photos-derived notes, and preferences. This cannot be undone. Reply 'yes, delete everything' to confirm.",
      };
    }

    const runtime = getSkintextRuntime(context.requestContext);
    const { userId, deleteAccountData } = runtime;
    await deleteUserMemory(userId);
    await (deleteAccountData ?? deleteAllUserData)(userId);
    runtime.accountDeleted = true;
    return {
      deleted: true,
      message:
        "All your data has been permanently deleted. If you message me again, we'll start fresh with a new setup.",
    };
  },
});
