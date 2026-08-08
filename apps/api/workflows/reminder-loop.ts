import { DAILY_SUMMARY_HOUR, WEEKLY_RECAP_DAY, WEEKLY_RECAP_HOUR } from "@skintext/shared";
import { sleep } from "workflow";
import {
  buildDailySummaryReminder,
  buildRoutineReminder,
  buildWeeklyRecapReminder,
  clearReminderRunId,
  isLocalDayOfWeek,
  loadReminderTimes,
  loadRoutineLog,
  loadUser,
  ownsReminderRun,
  resolveNextLocalTimestamp,
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

    const routineTimes = [];
    for (const time of customTimes) {
      routineTimes.push({
        label: time.label,
        hour: time.hour,
        minute: time.minute,
        emoji: time.label === "morning" ? "☀️" : time.label === "evening" ? "🌙" : "🧴",
        targetAt: await resolveNextLocalTimestamp(time.hour, time.minute, tz),
      });
    }
    routineTimes.sort((a, b) => a.targetAt - b.targetAt);

    for (const routine of routineTimes) {
      const waitMs = Math.max(0, routine.targetAt - Date.now());
      if (waitMs > 0) {
        await sleep(`${waitMs}ms`);
      }
      if (!(await ownsReminderRun(userId, generation))) break reminderCycle;
      if (Date.now() < routine.targetAt - EARLY_WAKE_TOLERANCE_MS) {
        continue reminderCycle;
      }

      const log = await loadRoutineLog(userId, tz);
      const alreadyCompleted = log.completedSlots.includes(
        routine.label === "morning" || routine.label === "evening" ? routine.label : "custom",
      );

      if (!alreadyCompleted) {
        const reminder = await buildRoutineReminder(routine.label, routine.emoji, locale, log);
        await sendReminderToAgent(userId, reminder, generation);
      }
    }

    // Send one reflection surface per day. Sunday gets the more useful weekly
    // view instead of stacking a daily summary, milestone, and recap.
    const weeklyRecapDay = await isLocalDayOfWeek(tz, WEEKLY_RECAP_DAY);
    const reflectionHour = weeklyRecapDay ? WEEKLY_RECAP_HOUR : DAILY_SUMMARY_HOUR;
    const reflectionTargetAt = await resolveNextLocalTimestamp(reflectionHour, 0, tz);
    const reflectionWait = Math.max(0, reflectionTargetAt - Date.now());
    if (reflectionWait > 0) {
      await sleep(`${reflectionWait}ms`);
    }
    if (!(await ownsReminderRun(userId, generation))) break;
    if (Date.now() < reflectionTargetAt - EARLY_WAKE_TOLERANCE_MS) {
      continue;
    }

    if (weeklyRecapDay) {
      const recap = await buildWeeklyRecapReminder(userId, locale);
      if (recap) {
        await sendReminderToAgent(userId, recap, generation);
      }
    } else {
      const summaryResult = await buildDailySummaryReminder(userId, locale);
      if (summaryResult) {
        await sendReminderToAgent(userId, summaryResult.text, generation);
      }
    }
  }
}
