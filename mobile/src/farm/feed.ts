import { feedByType, fmtBags } from "@farm/erp/derive";
import type { Product } from "@farm/erp/types";

/**
 * The feed types to choose from on a daily entry: those the unit has on
 * hand, each with its bags, the fullest first. With nothing on hand (or
 * figures from before types were kept) every type is offered.
 */
export function feedChoices(products: Product[], byType: ReturnType<typeof feedByType>, bagKg: number) {
  const inStock = byType.filter((t) => t.id !== null && t.stock > 1e-9).sort((a, b) => b.stock - a.stock);
  if (inStock.length === 0) return products.map((p) => ({ value: p.id, label: p.name }));
  return inStock.map((t) => ({ value: t.id as number, label: `${t.name} · ${fmtBags(t.stock, bagKg)}` }));
}
