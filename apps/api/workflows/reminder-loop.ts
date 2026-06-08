import {
  ADHERENCE_MILESTONES,
  DAILY_SUMMARY_HOUR,
  isDayOfWeek,
  msUntil,
  nextLocalTime,
  WEEKLY_RECAP_DAY,
  WEEKLY_RECAP_HOUR,
} from "@skintext/shared";
import { sleep } from "workflow";
import {
  clearReminderRunId,
  generateDailySummary,
  generateReminder,
  generateWeeklyRecap,
  loadReminderTimes,
  loadRoutineLog,
  loadUser,
  sendMsg,
} from "./steps/reminder-steps";

const EARLY_WAKE_TOLERANCE_MS = 1000;

export async function reminderLoop(userId: string) {
  "use workflow";

  reminderCycle: while (true) {
    const user = await loadUser(userId);
    if (!user) {
      await clearReminderRunId(userId);
      break;
    }

    const tz = user.timezone;
    const locale = user.locale;

    const customTimes = await loadReminderTimes(userId);
    if (!customTimes?.length) {
      await clearReminderRunId(userId);
      break;
    }

    const routineTimes = customTimes
      .map((t) => ({
        label: t.label,
        hour: t.hour,
        minute: t.minute,
        emoji: t.label === "morning" ? "☀️" : t.label === "evening" ? "🌙" : "🧴",
        target: nextLocalTime(t.hour, t.minute, tz),
      }))
      .sort((a, b) => a.target.getTime() - b.target.getTime());

    for (const routine of routineTimes) {
      const waitMs = msUntil(routine.target);
      if (waitMs > 0) {
        await sleep(`${waitMs}ms`);
      }
      if (Date.now() < routine.target.getTime() - EARLY_WAKE_TOLERANCE_MS) {
        continue reminderCycle;
      }

      const log = await loadRoutineLog(userId, tz);
      const alreadyCompleted = log.completedSlots.includes(
        routine.label === "morning" || routine.label === "evening" ? routine.label : "custom",
      );

      if (!alreadyCompleted) {
        const reminder = await generateReminder(
          userId,
          routine.label,
          routine.emoji,
          locale,
          user.name,
          log,
        );
        await sendMsg(userId, reminder);
      }
    }

    const summaryTarget = nextLocalTime(DAILY_SUMMARY_HOUR, 0, tz);
    const summaryWait = msUntil(summaryTarget);
    if (summaryWait > 0) {
      await sleep(`${summaryWait}ms`);
    }
    if (Date.now() < summaryTarget.getTime() - EARLY_WAKE_TOLERANCE_MS) {
      continue;
    }

    const summaryResult = await generateDailySummary(userId, locale);
    if (summaryResult) {
      await sendMsg(userId, summaryResult.text);

      const milestoneMsg = summaryResult.streakUpdated
        ? ADHERENCE_MILESTONES[summaryResult.streak.current]
        : undefined;
      if (milestoneMsg) {
        await sendMsg(userId, milestoneMsg);
      }
    }

    if (isDayOfWeek(tz, WEEKLY_RECAP_DAY)) {
      const recapTarget = nextLocalTime(WEEKLY_RECAP_HOUR, 0, tz);
      const recapWait = msUntil(recapTarget);
      if (recapWait > 0) {
        await sleep(`${recapWait}ms`);
      }
      if (Date.now() < recapTarget.getTime() - EARLY_WAKE_TOLERANCE_MS) {
        continue;
      }

      const recap = await generateWeeklyRecap(userId, locale);
      if (recap) {
        await sendMsg(userId, recap);
      }
    }
  }
}
