export const USER_REMINDER_TAG = "user_reminder";
export const USER_REMINDER_OPEN_TAG = `<${USER_REMINDER_TAG}>`;
export const USER_REMINDER_CLOSE_TAG = `</${USER_REMINDER_TAG}>`;
export const USER_REMINDER_TAG_EXAMPLE = `${USER_REMINDER_OPEN_TAG}...${USER_REMINDER_CLOSE_TAG}`;

export function wrapUserReminder(text: string): string {
  return `${USER_REMINDER_OPEN_TAG}\n${text.trim()}\n${USER_REMINDER_CLOSE_TAG}`;
}
