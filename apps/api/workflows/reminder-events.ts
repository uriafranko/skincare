export function buildRoutineReminderEvent(input: {
  routineLabel: string;
  routineEmoji: string;
  userLocale: string;
  userName: string;
  completedSlots: string[];
  entryCount: number;
  productsUsed: string[];
  streakDays: number;
  productNames: string[];
}): string {
  const productHint =
    input.productNames.length > 0
      ? `Saved products: ${input.productNames.slice(0, 5).join(", ")}`
      : "No saved products yet.";

  return `Generate a skincare routine reminder for the ${input.routineLabel} routine.
User locale: ${input.userLocale}
Routine emoji to lead with if useful: ${input.routineEmoji}
User first name: ${input.userName}
Today completed slots: ${input.completedSlots.join(", ") || "none"}
Entries logged today: ${input.entryCount}
Products used today: ${input.productsUsed.join(", ") || "none"}
Adherence streak: ${input.streakDays} days
${productHint}`;
}
