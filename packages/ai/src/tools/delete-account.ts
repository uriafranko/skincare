import { deleteAllUserData } from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

export type DeleteAccountData = (userId: string) => Promise<void>;

export function createDeleteAccountTool(deleteAccountData: DeleteAccountData = deleteAllUserData) {
  return tool({
    description:
      "Delete a user's account and ALL associated data permanently. Always call with confirmed=false first to warn the user, then with confirmed=true only after explicit confirmation.",
    inputSchema: z.object({
      userId: z.string(),
      confirmed: z.boolean().describe("false = show warning, true = actually delete"),
    }),
    execute: async ({ userId, confirmed }) => {
      if (!confirmed) {
        return {
          deleted: false,
          warning:
            "This will permanently delete ALL your data including routine history, saved products, saved photos, photos-derived notes, and preferences. This cannot be undone. Reply 'yes, delete everything' to confirm.",
        };
      }

      await deleteAccountData(userId);
      return {
        deleted: true,
        message:
          "All your data has been permanently deleted. If you message me again, we'll start fresh with a new setup.",
      };
    },
  });
}

export const deleteAccountTool = createDeleteAccountTool();
