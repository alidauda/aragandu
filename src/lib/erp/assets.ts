/**
 * The asset register's rules, shared by the screens and the server: the
 * conditions an asset can be in, and how tags like AF/AD/OFE/121 sort and
 * number (each kind of item gets its own run of numbers — 1, 21, 41… — as
 * on the farm's paper register).
 */

export const ASSET_CONDITIONS = ["good", "fair", "repair", "damaged", "lost"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  good: "Good",
  fair: "Fair",
  repair: "Needs repair",
  damaged: "Damaged",
  lost: "Lost",
};

export const CONDITION_TONE: Record<AssetCondition, { bg: string; fg: string }> = {
  good: { bg: "#e2f0ed", fg: "#016559" },
  fair: { bg: "#e8f1fb", fg: "#2f6fb3" },
  repair: { bg: "#fcf2de", fg: "#9a6a12" },
  damaged: { bg: "#fbeae7", fg: "#c7402f" },
  lost: { bg: "#ebf0ef", fg: "#5d6b6b" },
};

/** Reads a condition from a register or spreadsheet ("GOOD", "Needs repair"…). */
export function asCondition(v: string): AssetCondition | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("good") || s === "ok" || s === "new") return "good";
  if (s.startsWith("fair") || s.startsWith("average") || s.startsWith("used")) return "fair";
  if (s.includes("repair") || s.startsWith("faulty") || s.startsWith("bad")) return "repair";
  if (s.startsWith("damage") || s.startsWith("broken") || s.startsWith("spoil")) return "damaged";
  if (s.startsWith("lost") || s.startsWith("missing") || s.startsWith("stolen")) return "lost";
  return null;
}

/** "AF/AD/OFE/121" → { prefix: "AF/AD/OFE", number: 121 }; a tag without a number keeps it all as prefix. */
export function splitTag(tag: string): { prefix: string; number: number | null } {
  const m = tag.trim().match(/^(.*?)[/\-\s]?(\d+)$/);
  if (!m) return { prefix: tag.trim(), number: null };
  return { prefix: m[1].replace(/[/\-\s]+$/, ""), number: Number(m[2]) };
}

export const joinTag = (prefix: string, n: number) => `${prefix.trim().replace(/[/\-\s]+$/, "")}/${n}`;

/** Register order: by prefix, then number. */
export function byTag(a: { tag: string }, b: { tag: string }) {
  const x = splitTag(a.tag);
  const y = splitTag(b.tag);
  return x.prefix.localeCompare(y.prefix) || (x.number ?? 0) - (y.number ?? 0) || a.tag.localeCompare(b.tag);
}

/**
 * The next number for a kind of item under a prefix: after the last one of
 * that kind, else the start of the next run of 20 (1, 21, 41…).
 */
export function nextNumber(assets: { tag: string; name: string }[], name: string, prefix: string) {
  const p = prefix.trim().replace(/[/\-\s]+$/, "");
  const under = assets.map((a) => ({ ...splitTag(a.tag), name: a.name })).filter((t) => t.prefix === p && t.number !== null);
  const same = under.filter((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (same.length) return Math.max(...same.map((t) => t.number!)) + 1;
  if (under.length === 0) return 1;
  const top = Math.max(...under.map((t) => t.number!));
  return Math.floor(top / 20) * 20 + 21;
}
