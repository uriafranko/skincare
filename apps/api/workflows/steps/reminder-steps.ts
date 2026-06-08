import {
  buildDailyRoutineSummaryPrompt,
  buildRoutineReminderPrompt,
  buildWeeklyRoutineRecapPrompt,
  createDefaultGatewayModel,
} from "@skintext/ai";
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
import { decrypt, localDateString, sendMessage } from "@skintext/shared";
import { generateText } from "ai";

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

export async function sendMsg(userId: string, text: string) {
  "use step";
  const user = await getUser(userId);
  if (!user) return;
  const rawPhone = await decrypt(user.phone);
  await sendMessage(rawPhone, text);
}

export async function generateReminder(
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
  const productHint =
    products.length > 0
      ? `Saved products: ${products
          .slice(0, 5)
          .map((p) => p.name)
          .join(", ")}`
      : "No saved products yet.";

  const result = await generateText({
    model: createDefaultGatewayModel(),
    system: buildRoutineReminderPrompt(locale),
    prompt: `Generate a ${routineLabel} skincare routine reminder.
Routine emoji to lead with if useful: ${routineEmoji}
User first name: ${userName}
Today completed slots: ${log.completedSlots.join(", ") || "none"}
Entries logged today: ${log.entryCount}
Products used today: ${log.productsUsed.join(", ") || "none"}
Adherence streak: ${streak.current} days
${productHint}`,
  });
  return result.text;
}

export async function generateDailySummary(
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

  const result = await generateText({
    model: createDefaultGatewayModel(),
    system: buildDailyRoutineSummaryPrompt(locale),
    prompt: `Generate daily routine summary for ${user.name}.
AM: ${am}
PM: ${pm}
Products used: ${log.productsUsed.join(", ") || "none logged"}
Reactions/notes: ${log.reactions.join("; ") || "none"}
Entries:
${log.entries
  .map((e) => `- ${e.slot}: ${e.steps.map((s) => s.productName ?? s.name).join(", ")}`)
  .join("\n")}
Streak: ${updatedStreak.current} days`,
  });

  return { text: result.text, streak: updatedStreak, streakUpdated };
}

export async function generateWeeklyRecap(userId: string, locale: string): Promise<string | null> {
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

  const result = await generateText({
    model: createDefaultGatewayModel(),
    system: buildWeeklyRoutineRecapPrompt(locale),
    prompt: `Generate weekly recap for ${user.name}.
Daily breakdown:
${dayLines}
Done slots: ${doneSlots}/14
Products used: ${topProducts || "none logged"}
Reactions: ${Array.from(reactions).join("; ") || "none"}`,
  });

  return result.text;
}
