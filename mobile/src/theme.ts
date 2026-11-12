/** The farm's colours and sizes, the same family as the website. Light only: it's read outdoors. */
export const color = {
  brand: "#055a5b",
  brandDark: "#044647",
  brandSoft: "#e3efee",
  ink: "#12292a",
  body: "#465657",
  muted: "#738080",
  line: "#d6dfde",
  bg: "#f4f6f5",
  card: "#ffffff",
  good: "#1d7a4d",
  goodSoft: "#e5f3ea",
  warn: "#8a5d0c",
  warnSoft: "#fbf2dc",
  bad: "#c7402f",
  badSoft: "#fbe9e6",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 10, md: 14 } as const;

/** Text sizes. Inputs and buttons are large: they're used with wet or gloved hands. */
export const font = {
  small: 13,
  body: 15,
  label: 14,
  input: 18,
  title: 20,
  figure: 22,
} as const;
