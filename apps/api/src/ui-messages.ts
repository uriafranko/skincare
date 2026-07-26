import type { SendUiMessageInput } from "@skintext/ai";
import sharp from "sharp";
import { sendImageFile } from "@/sendblue";

export async function sendUiMessageAttachment(
  phone: string,
  { svg, filename, width, height }: SendUiMessageInput,
): Promise<void> {
  const png = await sharp(Buffer.from(svg)).resize({ width, height }).png().toBuffer();
  await sendImageFile(phone, new Blob([new Uint8Array(png)], { type: "image/png" }), filename);
}
