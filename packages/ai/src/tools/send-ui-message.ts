import { createTool } from "@mastra/core/tools";
import { renderMessageCard } from "@skintext/message-ui";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";

const messageCardSectionSchema = z.object({
  heading: z
    .string()
    .max(48)
    .optional()
    .describe("Optional short label for this group, such as Morning, Evening, or Watch for."),
  items: z
    .array(z.string().min(1).max(80))
    .min(1)
    .max(4)
    .describe("One to four concise, standalone lines shown as rows in this group."),
});

export const sendUiMessageTool = createTool({
  id: "send-ui-message",
  description:
    "Default to plain text. Render and send a visual iMessage card only for an explicit card/checklist/product-guide/progress request or when at least three structured items need scanning. Never use a card or form for a single question. Do not use for urgent safety guidance, saved user photos, or right-to-left text. After success, do not repeat the card contents.",
  inputSchema: z.object({
    kind: z
      .enum(["routine", "product", "progress", "note"])
      .describe(
        "Visual treatment: routine for AM/PM steps, product for product guidance, progress for logs or trends, and note for other structured skincare information.",
      ),
    title: z.string().min(1).max(56).describe("Clear card title."),
    subtitle: z
      .string()
      .max(120)
      .optional()
      .describe("Optional one-sentence context shown below the title."),
    sections: z
      .array(messageCardSectionSchema)
      .min(1)
      .max(3)
      .describe("One to three groups of concise rows. Keep the total card focused."),
    footer: z
      .string()
      .max(100)
      .optional()
      .describe("Optional brief caveat or next-step note at the bottom."),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    filename: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    message: z.string().optional(),
  }),
  execute: async (card, context) => {
    const { userId, sendUiMessage } = getSkintextRuntime(context.requestContext);
    if (!sendUiMessage) {
      return { sent: false, message: "Visual iMessage attachments are unavailable." };
    }
    if (/[\u0590-\u08ff]/u.test(JSON.stringify(card))) {
      return {
        sent: false,
        message: "Visual cards do not support right-to-left text; reply in plain text.",
      };
    }

    try {
      const rendered = await renderMessageCard(card);
      await sendUiMessage({ userId, ...rendered });
      return {
        sent: true,
        filename: rendered.filename,
        width: rendered.width,
        height: rendered.height,
      };
    } catch {
      return { sent: false, message: "The visual card could not be rendered or sent." };
    }
  },
});
