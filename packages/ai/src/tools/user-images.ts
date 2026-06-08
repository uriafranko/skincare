import { getUserImage, listUserImages } from "@skintext/db";
import type { UserImage } from "@skintext/shared";
import { tool } from "ai";
import { z } from "zod";

export interface SendUserImageInput {
  userId: string;
  image: UserImage;
  caption?: string;
}

export type SendUserImage = (input: SendUserImageInput) => Promise<void>;

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

export const listUserImagesTool = tool({
  description:
    "List the user's recent saved inbound skincare/product photos that are still available. Use this before sending or referring to an old photo when you need the image ID.",
  inputSchema: z.object({
    userId: z.string(),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  execute: async ({ userId, limit }) => {
    const images = await listUserImages(userId, limit ?? 6);
    if (images.length === 0) {
      return { images: [], message: "No saved user images are currently available." };
    }

    return { images: images.map(imageSummary) };
  },
});

export function createSendUserImageTool(sendUserImage: SendUserImage) {
  return tool({
    description:
      "Send one of the user's saved photos back to them in iMessage. Use when the user asks to see, compare, or reference an earlier photo. Call listUserImages first if you do not know the image ID.",
    inputSchema: z.object({
      userId: z.string(),
      imageId: z.string().describe("ID of the saved image to send."),
      caption: z
        .string()
        .max(300)
        .optional()
        .describe("Optional short caption to send with the image."),
    }),
    execute: async ({ userId, imageId, caption }) => {
      const image = await getUserImage(userId, imageId);
      if (!image) {
        return { sent: false, message: "Image not found or expired." };
      }

      const trimmedCaption = caption?.trim() || undefined;
      await sendUserImage({ userId, image, caption: trimmedCaption });

      return {
        sent: true,
        image: imageSummary(image),
      };
    },
  });
}
