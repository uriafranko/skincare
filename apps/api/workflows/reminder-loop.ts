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
  buildDailySummaryReminder,
  buildRoutineReminder,
  buildWeeklyRecapReminder,
  clearReminderRunId,
  loadReminderTimes,
  loadRoutineLog,
  loadUser,
  ownsReminderRun,
  sendReminderToAgent,
} from "./steps/reminder-steps";

const EARLY_WAKE_TOLERANCE_MS = 1000;

export async function reminderLoop(userId: string, generation: string) {
  "use workflow";

  reminderCycle: while (true) {
    if (!(await ownsReminderRun(userId, generation))) break;

    const user = await loadUser(userId);
    if (!user) {
      await clearReminderRunId(userId, generation);
      break;
    }

    const tz = user.timezone;
    const locale = user.locale;

    const customTimes = await loadReminderTimes(userId);
    if (!customTimes?.length) {
      await clearReminderRunId(userId, generation);
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
      if (!(await ownsReminderRun(userId, generation))) break reminderCycle;
      if (Date.now() < routine.target.getTime() - EARLY_WAKE_TOLERANCE_MS) {
        continue reminderCycle;
      }

      const log = await loadRoutineLog(userId, tz);
      const alreadyCompleted = log.completedSlots.includes(
        routine.label === "morning" || routine.label === "evening" ? routine.label : "custom",
      );

      if (!alreadyCompleted) {
        const reminder = await buildRoutineReminder(
          userId,
          routine.label,
          routine.emoji,
          locale,
          log,
        );
        await sendReminderToAgent(userId, reminder, generation);
      }
    }

    const summaryTarget = nextLocalTime(DAILY_SUMMARY_HOUR, 0, tz);
    const summaryWait = msUntil(summaryTarget);
    if (summaryWait > 0) {
      await sleep(`${summaryWait}ms`);
    }
    if (!(await ownsReminderRun(userId, generation))) break;
    if (Date.now() < summaryTarget.getTime() - EARLY_WAKE_TOLERANCE_MS) {
      continue;
    }

    const summaryResult = await buildDailySummaryReminder(userId, locale);
    if (summaryResult) {
      await sendReminderToAgent(userId, summaryResult.text, generation);

      const milestoneMsg = summaryResult.streakUpdated
        ? ADHERENCE_MILESTONES[summaryResult.streak.current]
        : undefined;
      if (milestoneMsg) {
        await sendReminderToAgent(userId, milestoneMsg, generation);
      }
    }

    if (isDayOfWeek(tz, WEEKLY_RECAP_DAY)) {
      const recapTarget = nextLocalTime(WEEKLY_RECAP_HOUR, 0, tz);
      const recapWait = msUntil(recapTarget);
      if (recapWait > 0) {
        await sleep(`${recapWait}ms`);
      }
      if (!(await ownsReminderRun(userId, generation))) break;
      if (Date.now() < recapTarget.getTime() - EARLY_WAKE_TOLERANCE_MS) {
        continue;
      }

      const recap = await buildWeeklyRecapReminder(userId, locale);
      if (recap) {
        await sendReminderToAgent(userId, recap, generation);
      }
    }
  }
}
