import type { UserImage } from "@skintext/shared";
import type { RequestLogger } from "evlog";
import { errorForLogging } from "@/logging";

type InspectionStage = "load" | "analyze";

type LoadImageDataUrl = (image: UserImage) => Promise<string>;

type AnalyzeImage = (input: { dataUrl: string; question: string }) => Promise<string>;

export async function inspectRetainedImageWithRetry({
  image,
  question,
  log,
  loadImageDataUrl,
  analyzeImage,
}: {
  image: UserImage;
  question: string;
  log: RequestLogger;
  loadImageDataUrl: LoadImageDataUrl;
  analyzeImage: AnalyzeImage;
}): Promise<string> {
  const maxAttempts = 2;
  let lastError: unknown = new Error("Retained-photo inspection failed.");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let stage: InspectionStage = "load";

    try {
      const dataUrl = await loadImageDataUrl(image);
      stage = "analyze";
      const analysis = await analyzeImage({ dataUrl, question });

      log.set({
        imageInspection: {
          success: true,
          attempts: attempt,
          recovered: attempt > 1,
        },
      });
      return analysis;
    } catch (error) {
      lastError = error;
      log.error(errorForLogging(error));
      log.set({
        imageInspection: {
          success: false,
          attempts: attempt,
          stage,
          retrying: attempt < maxAttempts,
        },
      });
    }
  }

  throw lastError;
}
