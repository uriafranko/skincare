import { generateObject, tool } from "ai";
import { log } from "evlog";
import { z } from "zod";
import { createDefaultGatewayModel } from "../models";

export const skincareImageAnalysisSchema = z.object({
  imageType: z.enum(["skin_photo", "product_label", "routine_shelf", "other"]),
  observations: z
    .array(z.string())
    .describe("Visible, non-diagnostic observations. Do not name diseases or conditions."),
  visibleText: z.string().nullable().describe("Readable label or ingredient text, if any."),
  likelyRoutineFit: z
    .array(z.string())
    .describe("How the visible product or routine may fit into morning/evening skincare."),
  watchouts: z
    .array(z.string())
    .describe("Potential irritation, duplication, or ingredient cautions stated conservatively."),
  recommendedNextStep: z.string().describe("One practical next step, phrased as routine support."),
  confidence: z.enum(["high", "medium", "low"]),
  safetyNotes: z
    .array(z.string())
    .describe("Relevant safety caveats, including clinician referral when appropriate."),
});

export type SkincareImageAnalysis = z.infer<typeof skincareImageAnalysisSchema>;

export const SKINCARE_IMAGE_ANALYSIS_PROMPT = `Analyze the user's skincare-related image.

Classify the image as:
- skin_photo: a face/body skin photo
- product_label: a product, label, packaging, or ingredient list
- routine_shelf: multiple skincare products or a routine lineup
- other: not useful for skincare routine support

Rules:
- Do not diagnose skin conditions, infections, allergies, or disease.
- Do not claim certainty from an image.
- Do not recommend prescription-only treatment.
- If the image shows severe swelling, burns, pus, spreading redness, eye-area symptoms, intense pain, or a rapidly changing lesion, recommend professional care.
- For skin photos, describe visible features only in cautious language such as "visible redness" or "appears dry/flaky".
- For products, read visible label or ingredient text when possible and explain likely routine fit and watchouts.
- For routine shelves, identify product types, possible duplicates, likely missing basics, and simple AM/PM placement.

Return concise structured JSON.`;

export function createAnalyzeSkincareImageTool(contextImageUrl?: string) {
  return tool({
    description:
      "Analyze the user's skincare or product photo. Classifies skin photos, product labels, and routine shelves with conservative, non-diagnostic routine guidance. The image is provided automatically -- no parameters needed.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!contextImageUrl) {
        return { error: "No image provided", imageType: "other", observations: [] };
      }

      try {
        let dataUrl: string;
        if (contextImageUrl.startsWith("data:")) {
          dataUrl = contextImageUrl;
        } else {
          const imageResponse = await fetch(contextImageUrl);
          if (!imageResponse.ok) {
            return {
              error: `Could not fetch image (${imageResponse.status})`,
              imageType: "other",
              observations: [],
            };
          }
          const buffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
          dataUrl = `data:${contentType};base64,${base64}`;
        }

        const result = await generateObject({
          model: createDefaultGatewayModel(),
          schema: skincareImageAnalysisSchema,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: SKINCARE_IMAGE_ANALYSIS_PROMPT },
                { type: "image", image: new URL(dataUrl) },
              ],
            },
          ],
        });

        const obj = result.object;
        log.info({
          tool: "analyzeSkincareImage",
          imageType: obj.imageType,
          confidence: obj.confidence,
          observationCount: obj.observations.length,
          watchoutCount: obj.watchouts.length,
        });

        return obj;
      } catch (err) {
        log.error({ tool: "analyzeSkincareImage", err: String(err) });
        return { error: String(err), imageType: "other", observations: [] };
      }
    },
  });
}
