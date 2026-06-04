import { describe, expect, test } from "bun:test";
import {
  sanitizeSkincareImageAnalysis,
  skincareImageAnalysisSchema,
} from "../tools/analyze-skincare-image";

describe("skincare image schema", () => {
  test("accepts skin photo analysis", () => {
    const parsed = skincareImageAnalysisSchema.safeParse({
      imageType: "skin_photo",
      observations: ["visible redness on the cheek"],
      visibleText: null,
      likelyRoutineFit: ["track as a progress note"],
      watchouts: ["avoid adding multiple new actives at once"],
      recommendedNextStep: "Keep the routine simple and watch for changes.",
      confidence: "medium",
      safetyNotes: ["Seek professional care if symptoms worsen."],
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts product label analysis", () => {
    const parsed = skincareImageAnalysisSchema.safeParse({
      imageType: "product_label",
      observations: ["label text is partially readable"],
      visibleText: "fragrance free moisturizer",
      likelyRoutineFit: ["moisturizer step"],
      watchouts: ["patch test if sensitive"],
      recommendedNextStep: "Use after cleansing.",
      confidence: "high",
      safetyNotes: [],
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects unsupported image type", () => {
    const parsed = skincareImageAnalysisSchema.safeParse({
      imageType: "before_after",
      observations: [],
      visibleText: null,
      likelyRoutineFit: [],
      watchouts: [],
      recommendedNextStep: "",
      confidence: "low",
      safetyNotes: [],
    });
    expect(parsed.success).toBe(false);
  });

  test("removes absent-symptom checklist observations from skin photos", () => {
    const sanitized = sanitizeSkincareImageAnalysis({
      imageType: "skin_photo",
      observations: ["visible shine on the forehead", "no obvious open wounds or marked swelling"],
      visibleText: null,
      likelyRoutineFit: ["basic routine support"],
      watchouts: [],
      recommendedNextStep: "Keep the routine simple.",
      confidence: "medium",
      safetyNotes: [],
    });

    expect(sanitized.observations).toEqual(["visible shine on the forehead"]);
  });
});
