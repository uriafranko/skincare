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

function sameList(current: string[], next: string[]): boolean {
  return current.length === next.length && current.every((value, index) => value === next[index]);
}

const clearFieldPatterns: Record<z.infer<typeof clearableField>, RegExp> = {
  name: /\bname\b|שם/i,
  skinType: /\bskin\s*type\b|hudtyp|סוג\s+עור/i,
  sensitivity: /\bsensitivit(?:y|ies)\b|känslighet|רגישות/i,
  concerns: /\bconcerns?\b|hudproblem|חששות|בעיות\s+עור/i,
  goals: /\bgoals?\b|mål|מטרות/i,
  allergies: /\ballerg(?:y|ies)\b|אלרג/i,
  currentProducts: /\b(?:current|saved)\s+products?\b|produkter|מוצרים/i,
  routinePreference: /\broutine\s+preference\b|rutinpreferens|העדפת\s+שגרה/i,
  communicationStyle: /\bcommunication\s+style\b|\bstyle\s+preference\b|kommunikationsstil|סגנון/i,
};

function explicitlyRequestsClear(text: string, field: z.infer<typeof clearableField>): boolean {
  const hasClearIntent =
    /\b(?:forget|clear|remove|delete|reset)\b|glöm|radera|ta bort|שכח|מחק|נקה/i.test(text);
  return hasClearIntent && clearFieldPatterns[field].test(text);
}

export const updateProfileTool = createTool({
  id: "update-profile",
  description:
    "Update or forget only canonical profile fields explicitly stated in the latest user message. Pass only changed fields; never copy the existing profile into this tool.",
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
    const rejectedChanges: string[] = [];
    const appliedClearFields = new Set<z.infer<typeof clearableField>>();
    let timezoneChanged = false;

    if (name && name !== user.name) {
      fields.name = name;
      changes.push(`name: ${name}`);
    }
    if (timezone && (timezone !== user.timezone || !user.timezoneConfirmed)) {
      timezoneChanged = true;
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
    if (skinType && skinType !== user.skinType) {
      fields.skinType = skinType;
      changes.push(`skin type: ${skinType}`);
    }
    if (sensitivity && sensitivity !== user.sensitivity) {
      fields.sensitivity = sensitivity;
      changes.push(`sensitivity: ${sensitivity}`);
    }
    if (concerns && !sameList(user.concerns, concerns)) {
      fields.concerns = stringifyList(concerns);
      changes.push(`concerns: ${concerns.join(", ") || "none"}`);
    }
    if (goals && !sameList(user.goals, goals)) {
      fields.goals = stringifyList(goals);
      changes.push(`goals: ${goals.join(", ") || "none"}`);
    }
    if (allergies && !sameList(user.allergies, allergies)) {
      fields.allergies = stringifyList(allergies);
      changes.push(`allergies/sensitivities: ${allergies.join(", ") || "none"}`);
    }
    if (currentProducts && !sameList(user.currentProducts, currentProducts)) {
      fields.currentProducts = stringifyList(currentProducts);
      changes.push(`current products: ${currentProducts.join(", ") || "none"}`);
    }
    if (routinePreference && routinePreference !== user.routinePreference) {
      fields.routinePreference = routinePreference;
      changes.push(`routine preference: ${routinePreference}`);
    }
    if (communicationStyle && communicationStyle !== user.communicationStyle) {
      fields.communicationStyle = communicationStyle;
      fields.styleOfferState = "chosen";
      changes.push(`communication style: ${communicationStyle}`);
    }

    for (const field of clearFields ?? []) {
      if (!explicitlyRequestsClear(runtime.inputText ?? "", field)) {
        rejectedChanges.push(
          `${field} was not cleared because the latest user message did not explicitly request it`,
        );
        continue;
      }
      switch (field) {
        case "name":
          if (!user.name) break;
          fields.name = "";
          appliedClearFields.add(field);
          changes.push("forgot name");
          break;
        case "skinType":
          if (user.skinType === "unsure") break;
          fields.skinType = "unsure";
          appliedClearFields.add(field);
          changes.push("forgot skin type");
          break;
        case "sensitivity":
          if (user.sensitivity === "unsure") break;
          fields.sensitivity = "unsure";
          appliedClearFields.add(field);
          changes.push("forgot sensitivity");
          break;
        case "concerns":
        case "goals":
        case "allergies":
        case "currentProducts":
          if (user[field].length === 0) break;
          fields[field] = stringifyList([]);
          appliedClearFields.add(field);
          changes.push(`forgot ${field}`);
          break;
        case "routinePreference":
          if (user.routinePreference === "simple") break;
          fields.routinePreference = "simple";
          appliedClearFields.add(field);
          changes.push("reset routine preference");
          break;
        case "communicationStyle":
          if (user.communicationStyle === "clear_expert") break;
          fields.communicationStyle = "clear_expert";
          fields.styleOfferState = "shown";
          appliedClearFields.add(field);
          changes.push("reset communication style");
          break;
      }
    }

    if (Object.keys(fields).length === 0) {
      return {
        updated: false,
        message: rejectedChanges[0] ?? "No profile changes were needed.",
        ...(rejectedChanges.length ? { rejectedChanges } : {}),
      };
    }

    await updateUser(userId, fields);
    if (runtime.agentContext.userProfile) {
      if (appliedClearFields.has("name")) {
        runtime.agentContext.userProfile.name = "";
        runtime.agentContext.userName = "";
      }
      if (fields.communicationStyle && communicationStyle) {
        runtime.agentContext.userProfile.communicationStyle = communicationStyle;
        runtime.agentContext.userProfile.styleOfferState = "chosen";
      }
      if (appliedClearFields.has("communicationStyle")) {
        runtime.agentContext.userProfile.communicationStyle = "clear_expert";
        runtime.agentContext.userProfile.styleOfferState = "shown";
      }
    }
    let recurringRemindersResynced = false;
    if (timezoneChanged && runtime.syncRecurringReminderSchedule) {
      const reminders = await getCustomReminderTimes(userId);
      if (reminders?.length) {
        await runtime.syncRecurringReminderSchedule({ userId, enabled: true });
        recurringRemindersResynced = true;
      }
    }
    return {
      updated: true,
      changes,
      ...(timezoneChanged
        ? {
            timezone,
            timezoneConfirmed: true,
            recurringRemindersResynced,
          }
        : {}),
      ...(rejectedChanges.length ? { rejectedChanges } : {}),
    };
  },
});
