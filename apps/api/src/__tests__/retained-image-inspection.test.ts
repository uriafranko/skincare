import { describe, expect, mock, test } from "bun:test";
import { inspectRetainedImageWithRetry } from "@/retained-image-inspection";

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

function createLog() {
  return {
    error: mock((_error: Error) => undefined),
    set: mock((_fields: Record<string, unknown>) => undefined),
  };
}

describe("retained image inspection retry", () => {
  test("returns immediately when the first inspection succeeds", async () => {
    const log = createLog();
    const loadImageDataUrl = mock(async () => "data:image/jpeg;base64,aW1hZ2U=");
    const analyzeImage = mock(async () => "Visible redness on the left cheek.");

    const result = await inspectRetainedImageWithRetry({
      image: retainedImage,
      question: "What is visible?",
      log: log as never,
      loadImageDataUrl,
      analyzeImage,
    });

    expect(result).toBe("Visible redness on the left cheek.");
    expect(loadImageDataUrl).toHaveBeenCalledTimes(1);
    expect(analyzeImage).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
    expect(log.set).toHaveBeenCalledWith({
      imageInspection: { success: true, attempts: 1, recovered: false },
    });
  });

  test("retries a failed image load and reports recovery", async () => {
    const log = createLog();
    const firstError = Object.assign(new Error("blob download temporarily unavailable"), {
      response: { authorization: "secret" },
    });
    let loadAttempt = 0;
    const loadImageDataUrl = mock(async () => {
      loadAttempt++;
      if (loadAttempt === 1) throw firstError;
      return "data:image/jpeg;base64,aW1hZ2U=";
    });
    const analyzeImage = mock(async () => "The photo is readable.");

    const result = await inspectRetainedImageWithRetry({
      image: retainedImage,
      question: "Can you read this photo?",
      log: log as never,
      loadImageDataUrl,
      analyzeImage,
    });

    expect(result).toBe("The photo is readable.");
    expect(loadImageDataUrl).toHaveBeenCalledTimes(2);
    expect(analyzeImage).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
    const loggedError = log.error.mock.calls[0]?.[0];
    expect(loggedError).toBeInstanceOf(Error);
    expect(loggedError?.message).toBe("blob download temporarily unavailable");
    expect(loggedError).not.toHaveProperty("response");
    expect(log.set).toHaveBeenLastCalledWith({
      imageInspection: { success: true, attempts: 2, recovered: true },
    });
  });

  test("retries a failed visual analysis", async () => {
    const log = createLog();
    const loadImageDataUrl = mock(async () => "data:image/jpeg;base64,aW1hZ2U=");
    let analysisAttempt = 0;
    const analyzeImage = mock(async () => {
      analysisAttempt++;
      if (analysisAttempt === 1) throw new Error("vision gateway timed out");
      return "The full face is visible.";
    });

    const result = await inspectRetainedImageWithRetry({
      image: retainedImage,
      question: "Scan the full face.",
      log: log as never,
      loadImageDataUrl,
      analyzeImage,
    });

    expect(result).toBe("The full face is visible.");
    expect(loadImageDataUrl).toHaveBeenCalledTimes(2);
    expect(analyzeImage).toHaveBeenCalledTimes(2);
    expect(log.set).toHaveBeenNthCalledWith(1, {
      imageInspection: {
        success: false,
        attempts: 1,
        stage: "analyze",
        retrying: true,
      },
    });
    expect(log.set).toHaveBeenLastCalledWith({
      imageInspection: { success: true, attempts: 2, recovered: true },
    });
  });

  test("throws the final error after both attempts fail", async () => {
    const log = createLog();
    const loadImageDataUrl = mock(async () => "data:image/jpeg;base64,aW1hZ2U=");
    const firstError = new Error("first vision failure");
    const finalError = new Error("second vision failure");
    let analysisAttempt = 0;
    const analyzeImage = mock(async () => {
      analysisAttempt++;
      throw analysisAttempt === 1 ? firstError : finalError;
    });

    await expect(
      inspectRetainedImageWithRetry({
        image: retainedImage,
        question: "Scan the full face.",
        log: log as never,
        loadImageDataUrl,
        analyzeImage,
      }),
    ).rejects.toThrow("second vision failure");

    expect(loadImageDataUrl).toHaveBeenCalledTimes(2);
    expect(analyzeImage).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.set).toHaveBeenLastCalledWith({
      imageInspection: {
        success: false,
        attempts: 2,
        stage: "analyze",
        retrying: false,
      },
    });
  });
});
