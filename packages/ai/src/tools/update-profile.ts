import { createTool } from "@mastra/core/tools";
import { getCustomReminderTimes, getUser, updateUser } from "@skintext/db";
import { isValidTimeZone, localDateString } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

const listField = z.array(z.string()).optional();
const clearableField = z.enum([
  "name",
  "skinType",
  "sensitivity",
  "concerns",
  "goals",
  "allergies",
  "currentProducts",
  "routinePreference",
  "communicationStyle",
]);

function stringifyList(value: string[]): string {
  return JSON.stringify(value);
}

export const updateProfileTool = createTool({
  id: "update-profile",
  description:
    "Update or forget canonical skincare profile fields, including communication style. Explicit profile updates override older conversation memory.",
  inputSchema: z.object({
    name: z.string().optional(),
    timezone: z
      .string()
      .optional()
      .describe(
        "Valid IANA timezone derived from a city or timezone explicitly stated by the user, e.g. America/New_York.",
      ),
    skinType: z.enum(["dry", "oily", "combination", "normal", "unsure"]).optional(),
    sensitivity: z.enum(["low", "medium", "high", "unsure"]).optional(),
    concerns: listField,
    goals: listField,
    allergies: listField,
    currentProducts: listField,
    routinePreference: z.enum(["simple", "standard", "detailed"]).optional(),
    ageBand: z.enum(["16_17", "18_plus"]).optional(),
    communicationStyle: z
      .enum(["clear_expert", "gentle_coach", "playful_guide", "straight_talk"])
      .optional(),
    clearFields: z.array(clearableField).optional(),
  }),
  execute: async (
    {
      name,
      timezone,
      skinType,
      sensitivity,
      concerns,
      goals,
      allergies,
      currentProducts,
      routinePreference,
      ageBand,
      communicationStyle,
      clearFields,
    },
    context,
  ) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { userId } = runtime;
    const user = await getUser(userId);
    if (!user) return { updated: false, message: "User not found." };
    if (timezone && !isValidTimeZone(timezone)) {
      return {
        updated: false,
        message: "Timezone must be a valid IANA timezone derived from the user's stated location.",
      };
    }

    const fields: Record<string, string> = {};
    const changes: string[] = [];
    let teenPhotoDeletion:
      | { attempted: number; deleted: number; queued: number; errors: number }
      | undefined;
    let deleteTeenPhotos = false;

    if (name) {
      fields.name = name;
      changes.push(`name: ${name}`);
    }
    if (timezone) {
      fields.timezone = timezone;
      fields.timezoneConfirmed = "true";
      changes.push(`timezone: ${timezone}`);
      runtime.timezone = timezone;
      runtime.agentContext.timezone = timezone;
      runtime.agentContext.localDate = localDateString(timezone);
      if (runtime.agentContext.userProfile) {
        runtime.agentContext.userProfile.timezone = timezone;
        runtime.agentContext.userProfile.timezoneConfirmed = true;
      }
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
    if (ageBand) {
      fields.ageBand = ageBand;
      changes.push(`age band: ${ageBand}`);
      if (ageBand === "16_17") {
        fields.photoRetentionConsentedAt = "";
        fields.photoRetentionConsentVersion = "";
        runtime.photoRetentionEnabled = false;
        runtime.skipCurrentPhotoRetention = true;
        deleteTeenPhotos = true;
      }
    }
    if (communicationStyle) {
      fields.communicationStyle = communicationStyle;
      fields.styleOfferState = "chosen";
      changes.push(`communication style: ${communicationStyle}`);
    }

    for (const field of clearFields ?? []) {
      switch (field) {
        case "name":
          fields.name = "";
          changes.push("forgot name");
          break;
        case "skinType":
          fields.skinType = "unsure";
          changes.push("forgot skin type");
          break;
        case "sensitivity":
          fields.sensitivity = "unsure";
          changes.push("forgot sensitivity");
          break;
        case "concerns":
        case "goals":
        case "allergies":
        case "currentProducts":
          fields[field] = stringifyList([]);
          changes.push(`forgot ${field}`);
          break;
        case "routinePreference":
          fields.routinePreference = "simple";
          changes.push("reset routine preference");
          break;
        case "communicationStyle":
          fields.communicationStyle = "clear_expert";
          fields.styleOfferState = "shown";
          changes.push("reset communication style");
          break;
      }
    }

    if (Object.keys(fields).length === 0) {
      return { updated: false, message: "No changes provided." };
    }

    await updateUser(userId, fields);
    if (deleteTeenPhotos && runtime.deleteSavedPhotos) {
      teenPhotoDeletion = await runtime.deleteSavedPhotos(userId);
    }
    if (runtime.agentContext.userProfile) {
      if (clearFields?.includes("name")) {
        runtime.agentContext.userProfile.name = "";
        runtime.agentContext.userName = "";
      }
      if (ageBand) {
        runtime.agentContext.userProfile.ageBand = ageBand;
        if (ageBand === "16_17") {
          runtime.agentContext.userProfile.photoRetentionConsentedAt = null;
          runtime.agentContext.userProfile.photoRetentionConsentVersion = null;
        }
      }
      if (communicationStyle) {
        runtime.agentContext.userProfile.communicationStyle = communicationStyle;
        runtime.agentContext.userProfile.styleOfferState = "chosen";
      }
      if (clearFields?.includes("communicationStyle")) {
        runtime.agentContext.userProfile.communicationStyle = "clear_expert";
        runtime.agentContext.userProfile.styleOfferState = "shown";
      }
    }
    let recurringRemindersResynced = false;
    if (timezone && runtime.syncRecurringReminderSchedule) {
      const reminders = await getCustomReminderTimes(userId);
      if (reminders?.length) {
        await runtime.syncRecurringReminderSchedule({ userId, enabled: true });
        recurringRemindersResynced = true;
      }
    }
    return {
      updated: true,
      changes,
      ...(timezone
        ? {
            timezone,
            timezoneConfirmed: true,
            recurringRemindersResynced,
          }
        : {}),
      ...(teenPhotoDeletion ? { savedPhotoDeletion: teenPhotoDeletion } : {}),
    };
  },
});
