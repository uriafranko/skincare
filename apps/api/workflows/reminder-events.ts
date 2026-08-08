export function buildRoutineReminderEvent(input: {
  routineLabel: string;
  routineEmoji: string;
  userLocale: string;
  completedSlots: string[];
  entryCount: number;
  productsUsed: string[];
}): string {
  return `Write one short, natural iMessage from Lily about the user's ${input.routineLabel} routine.
User locale: ${input.userLocale}
Routine emoji to lead with if useful: ${input.routineEmoji}
Today completed slots: ${input.completedSlots.join(", ") || "none"}
Entries logged today: ${input.entryCount}
Products used today: ${input.productsUsed.join(", ") || "none"}
Use working memory and retained history for relevant current products, concerns, preferences, and recent conversational context.
This should feel like Lily remembered them, not like an automated notification. Do not mention a streak, score, database, or missing log. Do not give a menu or ask for a command word. Invite a normal reply about how it went, whether they skipped it, or whether a little more time would help - whichever fits most naturally. Keep it easy to ignore without guilt.`;
}
