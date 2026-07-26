import { TZDate } from "@date-fns/tz";
import { addDays, format, getHours, isAfter, set } from "date-fns";

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function nextLocalTime(hour: number, minute: number, tz: string): Date {
  const now = new TZDate(new Date(), tz);
  let target = set(now, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
  if (isAfter(now, target)) {
    target = addDays(target, 1);
  }
  return new Date(target.getTime());
}

export function msUntil(target: Date): number {
  return Math.max(0, target.getTime() - Date.now());
}

export function localDateString(tz: string, date?: Date): string {
  const d = new TZDate(date ?? new Date(), tz);
  return format(d, "yyyy-MM-dd");
}

export function localHour(tz: string, date?: Date): number {
  const d = new TZDate(date ?? new Date(), tz);
  return getHours(d);
}

function parseLocalDate(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function localDateTimeToDate(
  localDate: string,
  hour: number,
  minute: number,
  tz: string,
): Date | null {
  const date = parseLocalDate(localDate);
  if (!date) return null;

  const local = TZDate.tz(tz, date.year, date.month - 1, date.day, hour, minute, 0, 0);
  if (
    local.getFullYear() !== date.year ||
    local.getMonth() !== date.month - 1 ||
    local.getDate() !== date.day ||
    local.getHours() !== hour ||
    local.getMinutes() !== minute
  ) {
    return null;
  }

  return new Date(local.getTime());
}

export function isDayOfWeek(tz: string, dayName: string, date?: Date): boolean {
  const d = new TZDate(date ?? new Date(), tz);
  const day = format(d, "EEEE");
  return day.toLowerCase() === dayName.toLowerCase();
}
