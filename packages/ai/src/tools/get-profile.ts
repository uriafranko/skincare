import { getUser } from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

export const getUserProfile = tool({
  description:
    "Get the user's skincare profile including skin type, sensitivity, concerns, goals, products, and preferences.",
  inputSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    return await getUser(userId);
  },
});
