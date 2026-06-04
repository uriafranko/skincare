import type { AdherenceStreak } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { getRedis } from "./client";

const streakKey = (userId: string) => `routine_streak:${userId}`;

export async function getAdherenceStreak(userId: string): Promise<AdherenceStreak> {
  const redis = getRedis();
  const data = await redis.hgetall(streakKey(userId));
  if (!data || Object.keys(data).length === 0) {
    return { current: 0, longest: 0, lastLogDate: "" };
  }
  const d = data as Record<string, unknown>;
  return {
    current: Number(d.current ?? 0),
    longest: Number(d.longest ?? 0),
    lastLogDate: d.lastLogDate ? String(d.lastLogDate) : "",
  };
}

export async function updateAdherenceStreak(
  userId: string,
  todayLocalDate: string,
): Promise<AdherenceStreak> {
  const redis = getRedis();
  const streak = await getAdherenceStreak(userId);

  if (streak.lastLogDate === todayLocalDate) {
    return streak;
  }

  const yesterdayStr = format(subDays(parseISO(todayLocalDate), 1), "yyyy-MM-dd");
  const newCurrent = streak.lastLogDate === yesterdayStr ? streak.current + 1 : 1;
  const newLongest = Math.max(streak.longest, newCurrent);

  await redis.hset(streakKey(userId), {
    current: String(newCurrent),
    longest: String(newLongest),
    lastLogDate: todayLocalDate,
  });

  return { current: newCurrent, longest: newLongest, lastLogDate: todayLocalDate };
}
