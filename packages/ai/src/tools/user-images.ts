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
    "List the user's recent saved inbound skincare/product photos that are still available. Use this before sending or referring to an old photo when you need the image ID.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(10).optional(),
  }),
  execute: async ({ limit }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    const images = await listUserImages(userId, limit ?? 6);
    if (images.length === 0) {
      return { images: [], message: "No saved user images are currently available." };
    }

    return { images: images.map(imageSummary) };
  },
});

export const sendUserImageTool = createTool({
  id: "send-user-image",
  description:
    "Send one of the user's saved photos back to them in iMessage. Use when the user asks to see, compare, or reference an earlier photo. Call listUserImages first if you do not know the image ID.",
  inputSchema: z.object({
    imageId: z.string().describe("ID of the saved image to send."),
    caption: z
      .string()
      .max(300)
      .optional()
      .describe("Optional short plain-text caption to send with the image. Never use Markdown."),
  }),
  execute: async ({ imageId, caption }, context) => {
    const { userId, sendUserImage } = getSkintextRuntime(context.requestContext);
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
