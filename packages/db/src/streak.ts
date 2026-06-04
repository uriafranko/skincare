import type { AdherenceStreak } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { adherenceStreaks } from "./schema";

export async function getAdherenceStreak(userId: string): Promise<AdherenceStreak> {
  const data = await getDb().query.adherenceStreaks.findFirst({
    where: eq(adherenceStreaks.userId, userId),
  });
  if (!data) {
    return { current: 0, longest: 0, lastLogDate: "" };
  }
  return {
    current: data.current,
    longest: data.longest,
    lastLogDate: data.lastLogDate,
  };
}

export async function updateAdherenceStreak(
  userId: string,
  todayLocalDate: string,
): Promise<AdherenceStreak> {
  const streak = await getAdherenceStreak(userId);

  if (streak.lastLogDate === todayLocalDate) {
    return streak;
  }

  const yesterdayStr = format(subDays(parseISO(todayLocalDate), 1), "yyyy-MM-dd");
  const newCurrent = streak.lastLogDate === yesterdayStr ? streak.current + 1 : 1;
  const newLongest = Math.max(streak.longest, newCurrent);

  await getDb()
    .insert(adherenceStreaks)
    .values({
      userId,
      current: newCurrent,
      longest: newLongest,
      lastLogDate: todayLocalDate,
    })
    .onConflictDoUpdate({
      target: adherenceStreaks.userId,
      set: {
        current: newCurrent,
        longest: newLongest,
        lastLogDate: todayLocalDate,
        updatedAt: sql`now()`,
      },
    });

  return { current: newCurrent, longest: newLongest, lastLogDate: todayLocalDate };
}
