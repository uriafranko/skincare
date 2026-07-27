import { z } from "zod";

export const routineSlotSchema = z.enum(["morning", "evening", "custom"]);

export const routineStepSchema = z.object({
  name: z.string().describe("Routine step name, e.g. cleanse, moisturize, sunscreen"),
  category: z.string().optional().describe("Product or step category"),
  productName: z.string().optional().describe("Product name used for this step"),
  notes: z.string().optional().describe("Short note about amount, order, or reaction"),
});
