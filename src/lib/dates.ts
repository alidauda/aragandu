/**
 * The farm's calendar. "Today" is the date in Lagos, not the server's or the
 * browser's zone, so a 00:30 production entry lands on the right day.
 */

const FARM_TZ = "Africa/Lagos";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today as YYYY-MM-DD in the farm's time zone. */
export function farmToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FARM_TZ }).format(now);
}

/** Monday of the week containing `isoDate`, as YYYY-MM-DD. */
export function weekStartOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → the Date Prisma writes to a `@db.Date` column. */
export const toDbDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** A `@db.Date` value back to YYYY-MM-DD. */
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

/** "Wed, 7 Oct 2026" */
export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Mon 5 Oct" */
export function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Oct" */
export function monthName(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "short",
  });
}
