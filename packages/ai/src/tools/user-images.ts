import { createTool } from "@mastra/core/tools";
import { getUserImage, listUserImages } from "@skintext/db";
import type { UserImage } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";
import { normalizeAssistantText } from "../text";

function imageSummary(image: UserImage) {
  return {
    id: image.id,
    createdAt: image.createdAt,
    expiresAt: image.expiresAt,
    sourceText: image.sourceText ?? null,
    contentType: image.contentType,
    size: image.size,
  };
}

export const listUserImagesTool = createTool({
  id: "list-user-images",
  description:
    "List metadata for the user's recent retained skincare/product photos. This does not inspect visual contents or resend an attachment. Use it only to find an image ID for inspectUserImage or sendUserImage.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).optional(),
  }),
  execute: async ({ limit }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext).agentContext;
    const images = await listUserImages(userId, limit ?? 6);
    if (images.length === 0) {
      return { images: [], message: "No saved user images are currently available." };
    }

    return { images: images.map(imageSummary) };
  },
});

export function createInspectUserImageTool(
  loadImage: (userId: string, imageId: string) => Promise<UserImage | null> = getUserImage,
) {
  return createTool({
    id: "inspect-user-image",
    description:
      "Visually inspect one retained photo and answer a specific visual question. This returns analysis text but does not resend the photo attachment. Use the retained photo ID from history when available; otherwise call listUserImages first.",
    inputSchema: z.object({
      imageId: z.string().describe("ID of the retained image to inspect."),
      question: z
        .string()
        .min(1)
        .max(800)
        .describe("The specific visual question to answer from the retained image."),
    }),
    execute: async ({ imageId, question }, context) => {
      const runtime = getSkintextRuntime(context.requestContext);
      const { inspectUserImage } = runtime;
      const { userId } = runtime.agentContext;
      if (!inspectUserImage) {
        return { inspected: false, message: "Retained-photo inspection is unavailable." };
      }

      const image = await loadImage(userId, imageId);
      if (!image) {
        return { inspected: false, message: "Image not found or expired." };
      }

      try {
        const analysis = await inspectUserImage({ userId, image, question });
        return { inspected: true, image: imageSummary(image), analysis };
      } catch {
        return {
          inspected: false,
          image: imageSummary(image),
          message: "The retained photo could not be inspected right now.",
        };
      }
    },
  });
}

export const inspectUserImageTool = createInspectUserImageTool();

export const sendUserImageTool = createTool({
  id: "send-user-image",
  description:
    "Resend one retained photo as an iMessage attachment. This does not inspect or compare its visual contents. Use only when the user asks to receive or see the earlier photo; call listUserImages first if its ID is unknown.",
  inputSchema: z.object({
    imageId: z.string().describe("ID of the saved image to send."),
    caption: z
      .string()
      .max(300)
      .optional()
      .describe("Optional short plain-text caption to send with the image. Never use Markdown."),
  }),
  execute: async ({ imageId, caption }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const { sendUserImage } = runtime;
    const { userId } = runtime.agentContext;
    if (!sendUserImage) return { sent: false, message: "Image sending is unavailable." };

    const image = await getUserImage(userId, imageId);
    if (!image) {
      return { sent: false, message: "Image not found or expired." };
    }

    const plainTextCaption = caption ? normalizeAssistantText(caption) : "";
    await sendUserImage({ userId, image, caption: plainTextCaption || undefined });
    return { sent: true, image: imageSummary(image) };
  },
});
