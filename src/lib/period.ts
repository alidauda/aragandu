/**
 * A reporting period: from/to farm days (inclusive), read from the URL so a
 * report can be bookmarked or shared. Pure — used on server and client.
 */

export type Period = { from: string; to: string; label: string; preset: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (y: number, m: number, d: number) => iso(new Date(Date.UTC(y, m, d)));
const valid = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

const fmt = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** The quick choices, relative to today (YYYY-MM-DD in Lagos). */
export function presets(today: string) {
  const [y, m] = today.split("-").map(Number);
  const mi = m - 1;
  const q = Math.floor(mi / 3) * 3;
  return [
    { key: "month", label: "This month", from: day(y, mi, 1), to: today },
    { key: "last-month", label: "Last month", from: day(y, mi - 1, 1), to: day(y, mi, 0) },
    { key: "quarter", label: "This quarter", from: day(y, q, 1), to: today },
    { key: "year", label: "This year", from: day(y, 0, 1), to: today },
    { key: "last-30", label: "Last 30 days", from: iso(new Date(Date.parse(today) - 29 * 86_400_000)), to: today },
    { key: "all", label: "All time", from: "2000-01-01", to: today },
  ];
}

/** The period in a URL's ?period= / ?from=&to= (default: this month). */
export function readPeriod(params: Record<string, string | string[] | undefined>, today: string): Period {
  const list = presets(today);
  const key = typeof params.period === "string" ? params.period : "";
  const preset = list.find((p) => p.key === key);
  if (preset) return { from: preset.from, to: preset.to, label: preset.label, preset: preset.key };
  if (valid(params.from) && valid(params.to)) {
    const [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    return { from, to, label: `${fmt(from)} – ${fmt(to)}`, preset: "custom" };
  }
  const m = list[0];
  return { from: m.from, to: m.to, label: m.label, preset: m.key };
}

/** A readable range for headings: "1 Oct 2026 – 25 Oct 2026". */
export const periodRange = (p: Pick<Period, "from" | "to">) =>
  p.from === "2000-01-01" ? `Up to ${fmt(p.to)}` : `${fmt(p.from)} – ${fmt(p.to)}`;
