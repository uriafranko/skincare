import { createTool } from "@mastra/core/tools";
import { updateUser } from "@skintext/db";
import { PHOTO_RETENTION_CONSENT_VERSION, type UserImage } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

export const managePhotoRetentionTool = createTool({
  id: "manage-photo-retention",
  description:
    "Manage separate 30-day photo-retention consent. Use set_future_retention to enable or disable future photo storage without saving the current attachment. Use save_current only after explicit consent to save the attached current photo; it also enables future retention when needed.",
  inputSchema: z.object({
    action: z.enum(["set_future_retention", "save_current"]),
    enabled: z.boolean().optional().describe("Required for set_future_retention."),
    consentToThirtyDayRetention: z.literal(true).optional().describe("Required for save_current."),
  }),
  execute: async (input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const account = runtime.agentContext.userAccount;
    if (!account) return { updated: false, message: "User not found." };

    if (input.action === "set_future_retention") {
      if (input.enabled === undefined) {
        return { updated: false, message: "A retention setting is required." };
      }
      const now = input.enabled ? new Date().toISOString() : "";
      await updateUser(runtime.userId, {
        photoRetentionConsentedAt: now,
        photoRetentionConsentVersion: input.enabled ? PHOTO_RETENTION_CONSENT_VERSION : "",
        photoRetentionOfferShownAt: account.photoRetentionOfferShownAt ?? new Date().toISOString(),
      });
      account.photoRetentionConsentedAt = now || null;
      account.photoRetentionConsentVersion = input.enabled ? PHOTO_RETENTION_CONSENT_VERSION : null;
      account.photoRetentionOfferShownAt ??= new Date().toISOString();
      runtime.photoRetentionEnabled = input.enabled;
      if (runtime.hasImage) {
        runtime.skipCurrentPhotoRetention = true;
      }
      return {
        updated: true,
        enabled: input.enabled,
        consentVersion: input.enabled ? PHOTO_RETENTION_CONSENT_VERSION : null,
        message: input.enabled
          ? runtime.hasImage
            ? "Future photos may be retained for 30 days after processing. The current photo was not saved."
            : "Future photos may be retained for 30 days after processing."
          : "Future photo retention is off. Previously saved photos were not deleted.",
      };
    }

    if (input.consentToThirtyDayRetention !== true) {
      return { saved: false, message: "Explicit 30-day retention consent is required." };
    }
    if (!runtime.hasImage || !runtime.saveCurrentPhoto) {
      return { saved: false, message: "There is no current photo available to save." };
    }
    if (runtime.currentPhotoSaved) {
      return { saved: true, image: runtime.currentPhotoSaved, alreadySaved: true };
    }

    if (!account.photoRetentionConsentedAt) {
      const now = new Date().toISOString();
      await updateUser(runtime.userId, {
        photoRetentionConsentedAt: now,
        photoRetentionConsentVersion: PHOTO_RETENTION_CONSENT_VERSION,
        photoRetentionOfferShownAt: account.photoRetentionOfferShownAt ?? now,
      });
      account.photoRetentionConsentedAt = now;
      account.photoRetentionConsentVersion = PHOTO_RETENTION_CONSENT_VERSION;
      account.photoRetentionOfferShownAt ??= now;
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
    "Permanently delete all retained user photos without deleting the account. This tool uses Mastra's native suspend/resume confirmation before deletion. Text derived from past photo discussions remains in agent memory.",
  inputSchema: z.object({}),
  suspendSchema: z.object({
    message: z.string(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean().describe("Whether the user explicitly confirmed deletion."),
  }),
  execute: async (_input, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    runtime.skipCurrentPhotoRetention = true;
    const warning =
      "This permanently deletes all retained photo blobs and metadata. Text from past photo discussions remains in retained agent memory unless the whole account is deleted. Reply yes to confirm.";
    const resumeData = context.agent?.resumeData;
    if (!resumeData) {
      if (context.agent) {
        return await context.agent.suspend({ message: warning });
      }
      return { deleted: false, warning };
    }
    if (!resumeData.confirmed) {
      return {
        deleted: false,
        message: "Saved photos were not deleted.",
      };
    }
    if (!runtime.deleteSavedPhotos) {
      return { deleted: false, message: "Saved-photo deletion is unavailable." };
    }
    const result = await runtime.deleteSavedPhotos(runtime.userId);
    return {
      ...result,
      deleted: result.errors === 0,
      agentMemoryStillRetained: true,
    };
  },
});
