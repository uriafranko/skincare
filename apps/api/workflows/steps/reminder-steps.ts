import { wrapUserReminder } from "@skintext/ai";
import {
  deleteReminderRunId,
  getAdherenceStreak,
  getAllProducts,
  getCustomReminderTimes,
  getOneOffReminder,
  getRoutineLogForDate,
  getUser,
  getWeeklyRoutineLogs,
  markOneOffReminderFailed as saveOneOffReminderFailed,
  markOneOffReminderSent as saveOneOffReminderSent,
  updateAdherenceStreak,
} from "@skintext/db";
import type { AdherenceStreak, DailyRoutineLog, UserProfile } from "@skintext/shared";
import { decrypt, localDateString } from "@skintext/shared";
import { createLogger } from "evlog";
import { runAgentMessage } from "../../src/agent-runner";
import { sendReplyBubbles } from "../../src/replies";
import { buildRoutineReminderEvent } from "../reminder-events";

export async function loadUser(userId: string): Promise<UserProfile | null> {
  "use step";
  return getUser(userId);
}

export async function loadReminderTimes(userId: string) {
  "use step";
  return getCustomReminderTimes(userId);
}

export async function clearReminderRunId(userId: string) {
  "use step";
  await deleteReminderRunId(userId);
}

export async function loadOneOffReminder(userId: string, reminderId: string) {
  "use step";
  return getOneOffReminder(userId, reminderId);
}

export async function markOneOffReminderSent(userId: string, reminderId: string) {
  "use step";
  await saveOneOffReminderSent(userId, reminderId);
}

export async function markOneOffReminderFailed(userId: string, reminderId: string) {
  "use step";
  await saveOneOffReminderFailed(userId, reminderId);
}

export async function loadRoutineLog(userId: string, timezone: string) {
  "use step";
  const localDate = localDateString(timezone);
  return getRoutineLogForDate(userId, localDate);
}

export async function sendReminderToAgent(userId: string, text: string): Promise<boolean> {
  "use step";
  const user = await getUser(userId);
  if (!user?.consentedAt) return false;

  const rawPhone = await decrypt(user.phone);
  const log = createLogger({
    scope: "scheduled_message",
    userId,
  });

  try {
    log.set({ input: { reminder: text.slice(0, 120) } });
    const reply = await runAgentMessage(log, user, wrapUserReminder(text));
    if (!reply) {
      log.set({ output: { replies: 0, bubbles: 0 } });
      return false;
    }

    const bubbles = await sendReplyBubbles(rawPhone, [reply]);
    log.set({ output: { replies: 1, bubbles } });
    return bubbles > 0;
  } catch (err) {
    log.error(err as Error);
    throw err;
  } finally {
    log.emit();
  }
}

export async function buildRoutineReminder(
  userId: string,
  routineLabel: string,
  routineEmoji: string,
  locale: string,
  userName: string,
  log: DailyRoutineLog,
): Promise<string> {
  "use step";
  const streak = await getAdherenceStreak(userId);
  const products = await getAllProducts(userId);

  return buildRoutineReminderEvent({
    routineLabel,
    routineEmoji,
    userLocale: locale,
    userName,
    completedSlots: log.completedSlots,
    entryCount: log.entryCount,
    productsUsed: log.productsUsed,
    streakDays: streak.current,
    productNames: products.map((p) => p.name),
  });
}

export async function buildDailySummaryReminder(
  userId: string,
  locale: string,
): Promise<{ text: string; streak: AdherenceStreak; streakUpdated: boolean } | null> {
  "use step";
  const user = await getUser(userId);
  if (!user) return null;

  const localDate = localDateString(user.timezone);
  const log = await getRoutineLogForDate(userId, localDate);
  if (log.entryCount === 0) return null;

  const streakUpdated = log.completedSlots.length > 0;
  const updatedStreak = streakUpdated
    ? await updateAdherenceStreak(userId, localDate)
    : await getAdherenceStreak(userId);
  const am = log.completedSlots.includes("morning") ? "done" : "not logged";
  const pm = log.completedSlots.includes("evening") ? "done" : "not logged";

  return {
    text: `Generate an end-of-day skincare routine summary for ${user.name}.
User locale: ${locale}
AM: ${am}
PM: ${pm}
Products used: ${log.productsUsed.join(", ") || "none logged"}
Reactions/notes: ${log.reactions.join("; ") || "none"}
Entries:
${log.entries
  .map((e) => `- ${e.slot}: ${e.steps.map((s) => s.productName ?? s.name).join(", ")}`)
  .join("\n")}
Streak: ${updatedStreak.current} days`,
    streak: updatedStreak,
    streakUpdated,
  };
}

export async function buildWeeklyRecapReminder(
  userId: string,
  locale: string,
): Promise<string | null> {
  "use step";
  const user = await getUser(userId);
  if (!user) return null;

  const localDate = localDateString(user.timezone);
  const weeklyLogs = await getWeeklyRoutineLogs(userId, localDate);
  const dayLines = weeklyLogs
    .map(({ date, log }) => {
      const dayName = new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
      });
      const am = log.completedSlots.includes("morning") ? "AM" : "--";
      const pm = log.completedSlots.includes("evening") ? "PM" : "--";
      return `${dayName}  ${am}/${pm}  ${log.entryCount} entries`;
    })
    .join("\n");

  const doneSlots = weeklyLogs.reduce(
    (sum, { log }) =>
      sum +
      Number(log.completedSlots.includes("morning")) +
      Number(log.completedSlots.includes("evening")),
    0,
  );
  const productCounts = new Map<string, number>();
  const reactions = new Set<string>();
  for (const { log } of weeklyLogs) {
    for (const product of log.productsUsed) {
      productCounts.set(product, (productCounts.get(product) ?? 0) + 1);
    }
    for (const reaction of log.reactions) {
      reactions.add(reaction);
    }
  }
  const topProducts = Array.from(productCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)
    .join(", ");

  return `Generate a weekly skincare routine recap for ${user.name}.
User locale: ${locale}
Daily breakdown:
${dayLines}
Done slots: ${doneSlots}/14
Products used: ${topProducts || "none logged"}
Reactions: ${Array.from(reactions).join("; ") || "none"}`;
}
