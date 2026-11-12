import { addDays } from "@farm/erp/derive";

/** Today on the farm (Lagos: an hour ahead of UTC all year), as YYYY-MM-DD, whatever zone the phone is set to. */
export const farmDay = (now = Date.now()) => new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);

/** How far back staff can record (the website's rule). */
export const BACKDATE_DAYS = 7;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday" or "Mon 9 Nov". */
export function dayName(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const d = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The days an entry can be for: today and the week before. */
export const recordDays = (today: string) => Array.from({ length: BACKDATE_DAYS + 1 }, (_, i) => addDays(today, -i));

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function ago(at: number, now = Date.now()) {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** A typed figure as a number: blank is 0, and a comma works as the decimal point. */
export const num = (v: string | undefined) => (v && v.trim() ? Number(v.trim().replace(",", ".")) : 0);
