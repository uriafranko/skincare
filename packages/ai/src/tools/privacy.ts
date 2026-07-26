import { createTool } from "@mastra/core/tools";
import { getActiveRoutineExperiment, getAllProducts, getUser, updateUser } from "@skintext/db";
import { PHOTO_RETENTION_CONSENT_VERSION, type UserImage } from "@skintext/shared";
import { z } from "zod";
import { getUserConversationHistoryStatus } from "../memory";
import { getSkintextRuntime } from "../runtime";

export const getPersonalizationSummaryTool = createTool({
  id: "get-personalization-summary",
  description:
    "Get a transparent summary of canonical profile facts, saved products, communication style, active experiment, photo-retention preference, and whether conversation history exists.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const [profile, products, activeExperiment, conversationHistory] = await Promise.all([
      getUser(runtime.userId),
      getAllProducts(runtime.userId),
      getActiveRoutineExperiment(runtime.userId),
      getUserConversationHistoryStatus(runtime.userId),
    ]);
    if (!profile) return { found: false, message: "User not found." };
    return {
      found: true,
      profile: {
        name: profile.name,
        ageBand: profile.ageBand,
        skinType: profile.skinType,
        sensitivity: profile.sensitivity,
        concerns: profile.concerns,
        goals: profile.goals,
        allergies: profile.allergies,
        routinePreference: profile.routinePreference,
        communicationStyle: profile.communicationStyle,
      },
      savedProducts: products.map(({ id, name, brand, category }) => ({
        id,
        name,
        brand,
        category,
      })),
      activeExperiment,
      photoRetention: {
        available: profile.ageBand !== "16_17",
        enabled: !!profile.photoRetentionConsentedAt && profile.ageBand !== "16_17",
        consentVersion: profile.photoRetentionConsentVersion,
        offerShown: !!profile.photoRetentionOfferShownAt,
      },
      conversationHistory,
    };
  },
});

export const clearConversationHistoryTool = createTool({
  id: "clear-conversation-history",
  description:
    "Clear retained Mastra conversation history without deleting the user's structured profile, products, logs, reminders, experiments, or account. Require confirmation.",
  inputSchema: z.object({
    confirmed: z.boolean(),
  }),
  execute: async ({ confirmed }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    runtime.skipCurrentPhotoRetention = true;
    if (!confirmed) {
      return {
        cleared: false,
        warning:
          "This permanently clears conversation history but keeps the profile, products, logs, reminders, experiments, and account. Ask the user to confirm.",
      };
    }
    runtime.clearMemoryAfterRun = true;
    return {
      cleared: true,
      message:
        "Conversation history will be cleared after this reply. The structured profile, products, logs, reminders, experiments, and account will remain.",
    };
  },
});

export const setPhotoRetentionTool = createTool({
  id: "set-photo-retention",
  description:
    "Enable or disable retention of future user photos. This is separate from general service consent and is unavailable to users aged 16-17.",
  inputSchema: z.object({
    enabled: z.boolean(),
  }),
  execute: async ({ enabled }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const profile = runtime.agentContext.userProfile;
    if (!profile) return { updated: false, message: "User not found." };
    if (enabled && profile.ageBand === "16_17") {
      return {
        updated: false,
        message: "Cross-session photo retention is unavailable for users aged 16-17.",
      };
    }

    const now = enabled ? new Date().toISOString() : "";
    await updateUser(runtime.userId, {
      photoRetentionConsentedAt: now,
      photoRetentionConsentVersion: enabled ? PHOTO_RETENTION_CONSENT_VERSION : "",
      photoRetentionOfferShownAt: profile.photoRetentionOfferShownAt ?? new Date().toISOString(),
    });
    profile.photoRetentionConsentedAt = now || null;
    profile.photoRetentionConsentVersion = enabled ? PHOTO_RETENTION_CONSENT_VERSION : null;
    profile.photoRetentionOfferShownAt ??= new Date().toISOString();
    runtime.photoRetentionEnabled = enabled;
    return {
      updated: true,
      enabled,
      consentVersion: enabled ? PHOTO_RETENTION_CONSENT_VERSION : null,
      message: enabled
        ? "Future photos may be retained for 30 days after processing."
        : "Future photo retention is off. Previously saved photos were not deleted.",
    };
  },
});

export const saveCurrentPhotoTool = createTool({
  id: "save-current-photo-for-tracking",
  description:
    "Save the photo attached to the current message after an adult user explicitly consents to 30-day photo retention. Never call without an attached current photo and explicit consent.",
  inputSchema: z.object({
    consentToThirtyDayRetention: z.literal(true),
  }),
  execute: async (_input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const profile = runtime.agentContext.userProfile;
    if (!profile) return { saved: false, message: "User not found." };
    if (profile.ageBand === "16_17") {
      return {
        saved: false,
        message: "Cross-session photo retention is unavailable for users aged 16-17.",
      };
    }
    if (!runtime.hasImage || !runtime.saveCurrentPhoto) {
      return { saved: false, message: "There is no current photo available to save." };
    }
    if (runtime.currentPhotoSaved) {
      return { saved: true, image: runtime.currentPhotoSaved, alreadySaved: true };
    }

    if (!profile.photoRetentionConsentedAt) {
      const now = new Date().toISOString();
      await updateUser(runtime.userId, {
        photoRetentionConsentedAt: now,
        photoRetentionConsentVersion: PHOTO_RETENTION_CONSENT_VERSION,
        photoRetentionOfferShownAt: profile.photoRetentionOfferShownAt ?? now,
      });
      profile.photoRetentionConsentedAt = now;
      profile.photoRetentionConsentVersion = PHOTO_RETENTION_CONSENT_VERSION;
      profile.photoRetentionOfferShownAt ??= now;
      runtime.photoRetentionEnabled = true;
    }

    let image: UserImage;
    try {
      image = await runtime.saveCurrentPhoto();
      runtime.currentPhotoSaved = image;
    } catch (error) {
      runtime.photoSaveError = error instanceof Error ? error.message : String(error);
      return {
        saved: false,
        message:
          "I couldn't save this photo. It is still available for the current reply, but it was not retained for tracking.",
      };
    }
    return {
      saved: true,
      image: {
        id: image.id,
        createdAt: image.createdAt,
        expiresAt: image.expiresAt,
      },
    };
  },
});

export const deleteSavedPhotosTool = createTool({
  id: "delete-saved-photos",
  description:
    "Permanently delete all retained user photos without deleting the rest of the account. Require confirmation. Explain that text derived from photo discussions remains until conversation history is cleared.",
  inputSchema: z.object({
    confirmed: z.boolean(),
  }),
  execute: async ({ confirmed }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    runtime.skipCurrentPhotoRetention = true;
    if (!confirmed) {
      return {
        deleted: false,
        warning:
          "This permanently deletes all retained photo blobs and metadata. Text from past photo discussions remains in conversation history unless that history is cleared separately. Ask the user to confirm.",
      };
    }
    if (!runtime.deleteSavedPhotos) {
      return { deleted: false, message: "Saved-photo deletion is unavailable." };
    }
    const result = await runtime.deleteSavedPhotos(runtime.userId);
    return {
      ...result,
      deleted: result.errors === 0,
      conversationHistoryStillRetained: true,
    };
  },
});
