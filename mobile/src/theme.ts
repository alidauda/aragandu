/** The farm's colours and sizes, the same family as the website. Light only: it's read outdoors. */
export const color = {
  brand: "#055a5b",
  brandDark: "#03403f",
  brandSoft: "#e3efee",
  /** The badge's yellow: small accents on the brand colour only. */
  sun: "#feea0d",
  ink: "#10272a",
  body: "#465657",
  muted: "#738080",
  line: "#dfe6e5",
  bg: "#f3f6f5",
  card: "#ffffff",
  good: "#1d7a4d",
  goodSoft: "#e5f3ea",
  warn: "#8a5d0c",
  warnSoft: "#fbf2dc",
  bad: "#c7402f",
  badSoft: "#fbe9e6",
  /** Chart marks (checked for colour-blind separation and contrast on white). */
  chart: "#0a9488",
  chart2: "#cf7a0c",
  grid: "#e9eeed",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 12, md: 18, lg: 28 } as const;

/** Text sizes. Inputs and buttons are large: they're used with wet or gloved hands. */
export const font = {
  small: 13,
  body: 15,
  label: 14,
  input: 18,
  title: 20,
  figure: 22,
} as const;

/** Jost, the website's typeface, by weight (loaded in the root layout). */
export const family = {
  "400": "Jost_400Regular",
  "500": "Jost_500Medium",
  "600": "Jost_600SemiBold",
  "700": "Jost_700Bold",
} as const;

/** The family for a weight as written in a style ("600", "bold"…). */
export const familyFor = (weight: unknown) => {
  const w = weight === "bold" ? 700 : Number(weight) || 400;
  return w >= 700 ? family["700"] : w >= 600 ? family["600"] : w >= 500 ? family["500"] : family["400"];
};

/** A soft lift for cards on the page. */
export const lift = "0 1px 2px rgba(16, 39, 42, 0.04), 0 6px 16px rgba(16, 39, 42, 0.05)";
