import {
  getAdherenceStreak,
  getAllProducts,
  getConversationMessages,
  getRedis,
  getRoutineLogForDate,
  getUser,
  recallAllMemories,
} from "@skintext/db";
import { encryptContent, localDateString } from "@skintext/shared";
import { tool } from "ai";
import { format, parseISO, subDays } from "date-fns";
import { z } from "zod";

export const exportDataTool = tool({
  description:
    "Export all of the user's skincare data in a machine-readable format. Use when the user asks for their data, a data export, or GDPR data access.",
  inputSchema: z.object({
    userId: z.string(),
    timezone: z.string(),
  }),
  execute: async ({ userId, timezone }) => {
    const [user, memories, streak, products, messages] = await Promise.all([
      getUser(userId),
      recallAllMemories(userId),
      getAdherenceStreak(userId),
      getAllProducts(userId),
      getConversationMessages(userId),
    ]);

    if (!user) return { exported: false, message: "User not found." };

    const localDate = localDateString(timezone);
    const endDate = parseISO(localDate);
    const routineLogs: Record<string, unknown> = {};
    for (let i = 0; i < 90; i++) {
      const dateStr = format(subDays(endDate, i), "yyyy-MM-dd");
      const log = await getRoutineLogForDate(userId, dateStr);
      if (log.entryCount > 0) {
        routineLogs[dateStr] = log;
      }
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: { ...user, phone: "[encrypted]" },
      routineLogs,
      products,
      adherenceStreak: streak,
      memories,
      recentMessages: messages,
    };

    const redis = getRedis();
    const blob = await encryptContent(JSON.stringify(exportData));
    await redis.set(`export:${userId}`, blob, { ex: 86400 });

    const routineDays = Object.keys(routineLogs).length;
    const totalEntries = Object.values(routineLogs).reduce(
      (sum: number, log) => sum + ((log as { entryCount: number }).entryCount ?? 0),
      0,
    );

    return {
      exported: true,
      summary: `Exported ${routineDays} days of routine data (${totalEntries} entries), ${products.length} saved products, and ${Object.keys(memories).length} saved preferences.`,
      availableFor: "24 hours",
    };
  },
});
