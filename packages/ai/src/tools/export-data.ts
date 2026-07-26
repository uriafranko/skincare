import { createTool } from "@mastra/core/tools";
import {
  getAdherenceStreak,
  getAllProducts,
  getRoutineLogForDate,
  getUser,
  listRoutineExperiments,
  listUserImages,
  saveExportBlob,
} from "@skintext/db";
import { encryptContent, localDateString } from "@skintext/shared";
import { format, parseISO, subDays } from "date-fns";
import { z } from "zod";
import { exportUserMemory } from "../memory";
import { getSkintextRuntime } from "../runtime";

export const exportDataTool = createTool({
  id: "export-data",
  description:
    "Export all of the user's skincare data in a machine-readable format. Use when the user asks for their data, a data export, or GDPR data access.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { userId, timezone } = getSkintextRuntime(context.requestContext);
    const [user, memory, streak, products, images, experiments] = await Promise.all([
      getUser(userId),
      exportUserMemory(userId),
      getAdherenceStreak(userId),
      getAllProducts(userId),
      listUserImages(userId, 50),
      listRoutineExperiments(userId, 100),
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
      experiments,
      adherenceStreak: streak,
      agentMemory: memory,
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
      summary: `Exported ${routineDays} days of routine data (${totalEntries} entries), ${products.length} saved products, ${images.length} saved photos, ${experiments.length} experiments, and ${memory.messages.length} conversation messages.`,
      availableFor: "24 hours",
    };
  },
});
