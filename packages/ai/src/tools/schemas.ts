import { z } from "zod";

export const routineSlotSchema = z.enum(["morning", "evening", "custom"]);

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year!, month! - 1, day!));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month! - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Must be a real calendar date in YYYY-MM-DD format.");

export const routineStepSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .describe("Routine step name, e.g. cleanse, moisturize, sunscreen"),
  productName: z.string().max(120).optional().describe("Product name used for this step"),
});
