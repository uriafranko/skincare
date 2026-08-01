import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";

const retainedImage = {
  id: "img_saved",
  userId: "usr_test",
  key: "user-images/saved.jpg",
  contentType: "image/jpeg",
  size: 42,
  source: "inbound" as const,
  sourceText: "left cheek",
  createdAt: "2026-07-27T00:00:00.000Z",
  expiresAt: "2026-08-26T00:00:00.000Z",
};

let imageAvailable = true;

const { createInspectUserImageTool } = await import("../tools/user-images");
const inspectUserImageTool = createInspectUserImageTool(async (userId: string, imageId: string) =>
  imageAvailable && userId === retainedImage.userId && imageId === retainedImage.id
    ? retainedImage
    : null,
);

function execute(
  input: { imageId: string; question: string },
  inspectUserImage?: (input: {
    userId: string;
    image: typeof retainedImage;
    question: string;
  }) => Promise<string>,
) {
  if (!inspectUserImageTool.execute) throw new Error("Tool is not executable.");
  const requestContext = new RequestContext();
  requestContext.set("runtime", {
    agentContext: { userId: "usr_test" },
    inspectUserImage,
  });
  return inspectUserImageTool.execute(input, { requestContext } as never);
}

beforeEach(() => {
  imageAvailable = true;
});

describe("retained user image inspection", () => {
  test("returns textual analysis without exposing raw image data", async () => {
    const inspect = mock(async () => "Visible redness on the left cheek.");
    const result = await execute(
      { imageId: "img_saved", question: "What changed on the cheek?" },
      inspect,
    );

    expect(inspect).toHaveBeenCalledWith({
      userId: "usr_test",
      image: retainedImage,
      question: "What changed on the cheek?",
    });
    expect(result).toEqual(
      expect.objectContaining({
        inspected: true,
        analysis: "Visible redness on the left cheek.",
        image: expect.objectContaining({ id: "img_saved" }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("data:image");
    expect(JSON.stringify(result)).not.toContain("user-images/saved.jpg");
  });

  test("does not inspect an expired or missing image", async () => {
    imageAvailable = false;
    const inspect = mock(async () => "should not run");
    const result = await execute({ imageId: "img_missing", question: "What is visible?" }, inspect);

    expect(result).toEqual({ inspected: false, message: "Image not found or expired." });
    expect(inspect).not.toHaveBeenCalled();
  });

  test("returns a safe temporary failure after inspection retries are exhausted", async () => {
    const inspect = mock(async () => {
      throw new Error("provider response contained private diagnostics");
    });
    const result = await execute({ imageId: "img_saved", question: "What is visible?" }, inspect);

    expect(result).toEqual(
      expect.objectContaining({
        inspected: false,
        image: expect.objectContaining({ id: "img_saved" }),
        message: "The retained photo could not be inspected right now.",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private diagnostics");
  });
});
