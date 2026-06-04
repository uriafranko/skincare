import { getUser, updateUser } from "@skintext/db";
import { tool } from "ai";
import { z } from "zod";

const listField = z.array(z.string()).optional();

function stringifyList(value: string[]): string {
  return JSON.stringify(value);
}

export const updateProfileTool = tool({
  description:
    "Update the user's skincare profile: skin type, sensitivity, concerns, goals, allergies, current products, routine preference, name, or timezone.",
  inputSchema: z.object({
    userId: z.string(),
    name: z.string().optional(),
    timezone: z.string().optional(),
    skinType: z.enum(["dry", "oily", "combination", "normal", "unsure"]).optional(),
    sensitivity: z.enum(["low", "medium", "high", "unsure"]).optional(),
    concerns: listField,
    goals: listField,
    allergies: listField,
    currentProducts: listField,
    routinePreference: z.enum(["simple", "standard", "detailed"]).optional(),
  }),
  execute: async ({
    userId,
    name,
    timezone,
    skinType,
    sensitivity,
    concerns,
    goals,
    allergies,
    currentProducts,
    routinePreference,
  }) => {
    const user = await getUser(userId);
    if (!user) return { updated: false, message: "User not found." };

    const fields: Record<string, string> = {};
    const changes: string[] = [];

    if (name) {
      fields.name = name;
      changes.push(`name: ${name}`);
    }
    if (timezone) {
      fields.timezone = timezone;
      changes.push(`timezone: ${timezone}`);
    }
    if (skinType) {
      fields.skinType = skinType;
      changes.push(`skin type: ${skinType}`);
    }
    if (sensitivity) {
      fields.sensitivity = sensitivity;
      changes.push(`sensitivity: ${sensitivity}`);
    }
    if (concerns) {
      fields.concerns = stringifyList(concerns);
      changes.push(`concerns: ${concerns.join(", ") || "none"}`);
    }
    if (goals) {
      fields.goals = stringifyList(goals);
      changes.push(`goals: ${goals.join(", ") || "none"}`);
    }
    if (allergies) {
      fields.allergies = stringifyList(allergies);
      changes.push(`allergies/sensitivities: ${allergies.join(", ") || "none"}`);
    }
    if (currentProducts) {
      fields.currentProducts = stringifyList(currentProducts);
      changes.push(`current products: ${currentProducts.join(", ") || "none"}`);
    }
    if (routinePreference) {
      fields.routinePreference = routinePreference;
      changes.push(`routine preference: ${routinePreference}`);
    }

    if (Object.keys(fields).length === 0) {
      return { updated: false, message: "No changes provided." };
    }

    await updateUser(userId, fields);
    return { updated: true, changes };
  },
});
