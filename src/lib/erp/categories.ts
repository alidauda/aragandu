/** Store item categories (InvCategory in the schema), in menu order. */
export const INV_CATEGORIES = ["medication", "equipment", "tools", "farm", "packaging", "supplies"] as const;
export type InvCategory = (typeof INV_CATEGORIES)[number];

export const INV_CATEGORY_LABEL: Record<InvCategory, string> = {
  medication: "Medication & vaccines",
  equipment: "Equipment",
  tools: "Tools",
  farm: "Farm items",
  packaging: "Packaging",
  supplies: "Supplies",
};
