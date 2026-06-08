import {
  deleteAllUserData,
  deleteReminderRunId,
  getReminderRunId,
  setReminderRunId,
} from "@skintext/db";
import type { UserProfile } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { getRun, start } from "workflow/api";
import { runAgentMessage } from "@/agent-runner";
import { deleteAllUserImageBlobs, sendStoredUserImage } from "@/user-images";
import { oneOffReminderWorkflow } from "../../workflows/one-off-reminder";
import { reminderLoop } from "../../workflows/reminder-loop";

export async function handleMessage(
  log: RequestLogger,
  user: UserProfile,
  rawPhone: string,
  text: string,
  imageUrl?: string,
): Promise<string | null> {
  return runAgentMessage(log, user, text, {
    imageUrl,
    hasImage: !!imageUrl,
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
    syncRecurringReminderSchedule: async ({ userId, enabled }) => {
      const existingRunId = await getReminderRunId(userId);

      if (existingRunId) {
        const run = getRun(existingRunId);
        if (await run.exists) {
          const status = await run.status;
          if (status === "pending" || status === "running") {
            await run.wakeUp();
            return existingRunId;
          }
        }
        await deleteReminderRunId(userId);
      }

      if (!enabled) {
        await deleteReminderRunId(userId);
        return undefined;
      }

      const run = await start(reminderLoop, [userId]);
      await setReminderRunId(userId, run.runId);
      return run.runId;
    },
  });
}
