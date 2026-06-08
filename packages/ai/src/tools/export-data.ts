import {
  getAdherenceStreak,
  getAllProducts,
  getConversationMessages,
  getRoutineLogForDate,
  getUser,
  listUserImages,
  recallAllMemories,
  saveExportBlob,
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
    const [user, memories, streak, products, messages, images] = await Promise.all([
      getUser(userId),
      recallAllMemories(userId),
      getAdherenceStreak(userId),
      getAllProducts(userId),
      getConversationMessages(userId),
      listUserImages(userId, 50),
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
      savedImages: images,
      adherenceStreak: streak,
      memories,
      recentMessages: messages,
    };

    const blob = await encryptContent(JSON.stringify(exportData));
    await saveExportBlob(userId, blob, 86400);

    const routineDays = Object.keys(routineLogs).length;
    const totalEntries = Object.values(routineLogs).reduce(
      (sum: number, log) => sum + ((log as { entryCount: number }).entryCount ?? 0),
      0,
    );

    return {
      exported: true,
      summary: `Exported ${routineDays} days of routine data (${totalEntries} entries), ${products.length} saved products, ${images.length} saved photos, and ${Object.keys(memories).length} saved preferences.`,
      availableFor: "24 hours",
    };
  },
});
