export function buildRoutineReminderEvent(input: {
  routineLabel: string;
  routineEmoji: string;
  userLocale: string;
  completedSlots: string[];
  entryCount: number;
  productsUsed: string[];
  streakDays: number;
}): string {
  return `Generate a skincare routine reminder for the ${input.routineLabel} routine.
User locale: ${input.userLocale}
Routine emoji to lead with if useful: ${input.routineEmoji}
Today completed slots: ${input.completedSlots.join(", ") || "none"}
Entries logged today: ${input.entryCount}
Products used today: ${input.productsUsed.join(", ") || "none"}
Adherence streak: ${input.streakDays} days
Use working memory and retained history for the user's name, current products, concerns, and preferences.`;
}
