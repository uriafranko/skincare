import { deleteAllUserData } from "@skintext/db";
import type { UserProfile } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { getRun, start } from "workflow/api";
import { runAgentMessage } from "@/agent-runner";
import type { NormalizedImage } from "@/image";
import { reminderRunManager } from "@/reminder-runs";
import { sendUiMessageAttachment } from "@/ui-messages";
import { deleteAllUserImageBlobs, saveInboundUserImage, sendStoredUserImage } from "@/user-images";
import { oneOffReminderWorkflow } from "../../workflows/one-off-reminder";

export async function handleMessage(
  log: RequestLogger,
  user: UserProfile,
  rawPhone: string,
  text: string,
  imageUrl?: string,
  currentImage?: NormalizedImage,
  sourceMessageId?: string,
): Promise<string | null> {
  return runAgentMessage(log, user, text, {
    imageUrl,
    hasImage: !!imageUrl,
    sendUiMessage: (input) => sendUiMessageAttachment(rawPhone, input),
    saveCurrentPhoto: currentImage
      ? async () =>
          saveInboundUserImage({
            userId: user.id,
            image: currentImage,
            text,
            messageId: sourceMessageId,
            log,
          })
      : undefined,
    deleteSavedPhotos: async (deleteUserId) => deleteAllUserImageBlobs(deleteUserId, log),
    sendUserImage: async ({ image, caption }) => {
      await sendStoredUserImage({ phone: rawPhone, image, caption });
    },
    deleteAccountData: async (deleteUserId) => {
      await deleteAllUserImageBlobs(deleteUserId, log).catch((error) => {
        log.error(error as Error);
        log.set({ imageDeleteError: true });
      });
      await deleteAllUserData(deleteUserId);
    },
    scheduleOneOffReminderWorkflow: async ({ userId, reminderId }) => {
      const run = await start(oneOffReminderWorkflow, [userId, reminderId]);
      return run.runId;
    },
    cancelOneOffReminderWorkflow: async ({ workflowRunId }) => {
      const run = getRun(workflowRunId);
      if (!(await run.exists)) return false;
      const status = await run.status;
      if (status !== "pending" && status !== "running") return false;
      await run.cancel();
      return true;
    },
    syncRecurringReminderSchedule: ({ userId, enabled }) =>
      reminderRunManager.sync(userId, enabled),
  });
}
