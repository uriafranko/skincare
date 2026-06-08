import { msUntil } from "@skintext/shared";
import { sleep } from "workflow";
import {
  loadOneOffReminder,
  loadUser,
  markOneOffReminderFailed,
  markOneOffReminderSent,
  sendReminderToAgent,
} from "./steps/reminder-steps";

export async function oneOffReminderWorkflow(userId: string, reminderId: string) {
  "use workflow";

  const reminder = await loadOneOffReminder(userId, reminderId);
  if (reminder?.status !== "scheduled") return;

  const waitMs = msUntil(new Date(reminder.sendAt));
  if (waitMs > 0) {
    await sleep(`${waitMs}ms`);
  }

  const latest = await loadOneOffReminder(userId, reminderId);
  if (latest?.status !== "scheduled") return;

  const user = await loadUser(userId);
  if (!user) return;

  if (!user.consentedAt) {
    await markOneOffReminderFailed(userId, reminderId);
    return;
  }

  const sent = await sendReminderToAgent(userId, latest.message);
  if (sent) {
    await markOneOffReminderSent(userId, reminderId);
  } else {
    await markOneOffReminderFailed(userId, reminderId);
  }
}
