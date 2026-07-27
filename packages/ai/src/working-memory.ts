import type {
  CommunicationStyle,
  RoutinePreference,
  SensitivityLevel,
  SkinType,
} from "@skintext/shared";
import { z } from "zod";

export interface WorkingMemorySeed {
  name: string;
  replyLanguage: string;
  skinType: SkinType;
  sensitivity: SensitivityLevel;
  concerns: readonly string[];
  goals: readonly string[];
  allergiesAndAvoids: readonly string[];
  currentProducts: readonly string[];
  routinePreference: RoutinePreference;
  communicationStyle: CommunicationStyle;
}

const communicationStyleSchema = z
  .enum(["clear_expert", "gentle_coach", "playful_guide", "straight_talk"])
  .describe("The user's current preferred response style.");

const productSchema = z.object({
  name: z.string().describe("Product name."),
  brand: z.string().optional().describe("Brand, only when known."),
  category: z.string().optional().describe("Product category or routine function."),
  keyIngredients: z
    .array(z.string())
    .optional()
    .describe("Only ingredients that are useful for placement, compatibility, or safety."),
  notes: z
    .string()
    .optional()
    .describe("Compact current-use, placement, reaction, or preference notes."),
});

const experimentSchema = z.object({
  change: z.string().describe("The single variable currently being tested."),
  baseline: z.string().optional().describe("The relevant baseline before the change."),
  startedAt: z.string().optional().describe("Known start date or timestamp."),
  reviewAt: z.string().optional().describe("Agreed review date or condition."),
});

const experimentOutcomeSchema = z.object({
  change: z.string().describe("The variable that was tested."),
  outcome: z.enum(["helped", "no_change", "worse", "inconclusive"]),
  notes: z.string().optional().describe("Compact outcome evidence or caveats."),
  endedAt: z.string().optional().describe("Known completion or stop date."),
});

export const skintextWorkingMemorySchema = z
  .object({
    profile: z
      .object({
        name: z.string().optional(),
        replyLanguage: z.string().optional().describe("Preferred reply language or locale."),
        skinType: z.enum(["dry", "oily", "combination", "normal", "unsure"]).optional(),
        sensitivity: z.enum(["low", "medium", "high", "unsure"]).optional(),
        concerns: z.array(z.string()).optional(),
        goals: z.array(z.string()).optional(),
        allergiesAndAvoids: z.array(z.string()).optional(),
        routinePreference: z.enum(["simple", "standard", "detailed"]).optional(),
        communicationStyle: communicationStyleSchema.optional(),
      })
      .optional()
      .describe(
        "Current user details and preferences. Explicit recent corrections override older values.",
      ),
    products: z
      .array(productSchema)
      .optional()
      .describe(
        "The complete current product roster. Replace this array when products are added, corrected, stopped, or forgotten.",
      ),
    activeExperiment: experimentSchema
      .nullable()
      .optional()
      .describe(
        "The one current skincare experiment, or null after it is completed, stopped, or removed.",
      ),
    recentExperimentOutcome: experimentOutcomeSchema
      .nullable()
      .optional()
      .describe(
        "Only the most recent completed experiment outcome; older history stays in observations.",
      ),
    pendingFollowUps: z
      .array(z.string())
      .optional()
      .describe("Current unresolved skincare follow-ups or review conditions."),
  })
  .describe(
    "Compact current skincare state. Operational timezone comes from turn context. Do not copy routine-log history, raw photos, diagnoses, or long conversation summaries here.",
  );

export type SkintextWorkingMemory = z.infer<typeof skintextWorkingMemorySchema>;

export function buildOnboardingWorkingMemory(seed: WorkingMemorySeed): SkintextWorkingMemory {
  return {
    profile: {
      name: seed.name,
      replyLanguage: seed.replyLanguage,
      skinType: seed.skinType,
      sensitivity: seed.sensitivity,
      concerns: [...seed.concerns],
      goals: [...seed.goals],
      allergiesAndAvoids: [...seed.allergiesAndAvoids],
      routinePreference: seed.routinePreference,
      communicationStyle: seed.communicationStyle,
    },
    products: seed.currentProducts.map((name) => ({ name })),
    activeExperiment: null,
    recentExperimentOutcome: null,
    pendingFollowUps: [],
  };
}
