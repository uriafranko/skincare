import { createTool } from "@mastra/core/tools";
import { getUser } from "@skintext/db";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

export const getUserProfile = createTool({
  id: "get-user-profile",
  description:
    "Get the user's skincare profile including their active timezone and whether the user confirmed it, plus skin type, concerns, products, and preferences.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    return await getUser(getSkintextRuntime(context.requestContext).userId);
  },
});
