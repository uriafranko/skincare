import { describe, expect, mock, test } from "bun:test";
import sharp from "sharp";

const sendImageFile = mock((_phone: string, _file: Blob, _filename: string) => Promise.resolve());

mock.module("@/sendblue", () => ({ sendImageFile }));

const { sendUiMessageAttachment } = await import("../ui-messages");

describe("sendUiMessageAttachment", () => {
  test("rasterizes the card at the requested size and sends it as a PNG", async () => {
    await sendUiMessageAttachment("+15555550123", {
      userId: "usr_test",
      svg: '<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#111612"/></svg>',
      filename: "routine-card.png",
      width: 20,
      height: 20,
    });

    expect(sendImageFile).toHaveBeenCalledTimes(1);
    const [phone, file, filename] = sendImageFile.mock.calls[0]!;
    expect(phone).toBe("+15555550123");
    expect(filename).toBe("routine-card.png");
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).type).toBe("image/png");

    const metadata = await sharp(await (file as Blob).arrayBuffer()).metadata();
    expect(metadata.width).toBe(20);
    expect(metadata.height).toBe(20);
  });
});
