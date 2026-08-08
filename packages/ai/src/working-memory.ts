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
  status: z
    .enum(["current", "considering", "paused", "stopped"])
    .optional()
    .describe("Current user-confirmed relationship to this product."),
  keyIngredients: z
    .array(z.string())
    .optional()
    .describe("Only ingredients that are useful for placement, compatibility, or safety."),
  notes: z
    .string()
    .optional()
    .describe("Compact current-use, placement, reaction, or preference notes."),
  placement: z.string().optional().describe("Confirmed or adopted routine placement."),
  cadence: z.string().optional().describe("Confirmed or adopted frequency, when useful."),
  lastConfirmedAt: z
    .string()
    .optional()
    .describe("When the user most recently confirmed the product's current status."),
  source: z
    .enum(["user", "photo_confirmed"])
    .optional()
    .describe(
      "How the current product state was confirmed. Never create a source for an unconfirmed photo inference.",
    ),
});

const routinePlanStepSchema = z.object({
  name: z.string().describe("Step or product name in plain language."),
  productName: z.string().optional().describe("Product name, only when known."),
  cadence: z.string().optional().describe("Frequency when it is not simply every routine."),
  notes: z.string().optional().describe("One compact placement or safety note."),
});

const routinePlanSchema = z.object({
  morning: z.array(routinePlanStepSchema).optional(),
  evening: z.array(routinePlanStepSchema).optional(),
  minimumMorning: z.array(routinePlanStepSchema).optional(),
  minimumEvening: z.array(routinePlanStepSchema).optional(),
  lastConfirmedAt: z.string().optional(),
  notes: z
    .string()
    .optional()
    .describe("Compact plan-level context, such as travel mode or a temporary simplification."),
});

const experimentSchema = z.object({
  change: z.string().describe("The single variable currently being tested."),
  baseline: z.string().optional().describe("The relevant baseline before the change."),
  focus: z
    .string()
    .optional()
    .describe("The one neutral user-chosen thing to notice during the experiment."),
  cadence: z.string().optional().describe("The agreed starting frequency."),
  stopConditions: z
    .array(z.string())
    .optional()
    .describe("Compact, pre-agreed reasons to stop or seek help."),
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
    currentRoutine: routinePlanSchema
      .nullable()
      .optional()
      .describe(
        "The user's currently adopted routine plan. Keep this null until the user explicitly adopts or confirms a proposed plan.",
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
    "Compact current skincare state. Operational timezone comes from account-state. Do not copy routine-log history, raw photos, unconfirmed photo inferences, diagnoses, or long conversation summaries here.",
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
    products: seed.currentProducts.map((name) => ({ name, status: "current", source: "user" })),
    currentRoutine: null,
    activeExperiment: null,
    recentExperimentOutcome: null,
    pendingFollowUps: [],
  };
}
