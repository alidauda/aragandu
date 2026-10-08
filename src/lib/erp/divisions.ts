/** The farm's divisions — feed requests, internal feed sales and store moves. */
export const DIVISIONS = ["layers", "broilers", "ruminants"] as const;
export type Division = (typeof DIVISIONS)[number];

/** How a division appears as an internal feed buyer: "Layers". */
export const divisionBuyer = (d: string) => d[0].toUpperCase() + d.slice(1).toLowerCase();

/** True when an internal feed sale went to this division (case-insensitive). */
export const isDivisionBuyer = (buyer: string, d: Division) =>
  buyer.trim().toLowerCase() === d;
