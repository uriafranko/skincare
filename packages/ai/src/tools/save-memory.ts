import { saveMemory } from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

export const saveMemoryTool = tool({
  description:
    "Save a user preference, fact, or skincare note for future reference. Use this when the user mentions skin sensitivities, allergies, product preferences, routine habits, or any personal detail worth remembering.",
  inputSchema: z.object({
    userId: z.string(),
    key: z
      .string()
      .describe(
        "Short descriptive label like 'skin_type', 'sensitivities', 'preferred_cleanser', 'retinoid_tolerance', or 'preferred_routine'",
      ),
    value: z.string().describe("The fact to remember"),
  }),
  execute: async ({ userId, key, value }) => {
    await saveMemory(userId, key, value);
    return { saved: true, key, value };
  },
});
