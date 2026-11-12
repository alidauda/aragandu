import { useState } from "react";
import { Pressable, View } from "react-native";

import { canAct } from "@farm/access";
import { crackedInStore, eggStock, fmtK, fmtN } from "@farm/erp/derive";
import { CRACKED, EGGS } from "@farm/erp/products";
import type { ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure } from "@/components/card";
import { Chips } from "@/components/chips";
import { DayChips } from "@/components/day-chips";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { dayName, farmDay, num } from "@/farm/day";
import { useFarm } from "@/farm/store";
import { useSend } from "@/hooks/use-send";
import { color, font, radius, space } from "@/theme";
import { Text } from "@/components/text";

/** How many buyers the list shows at once; typing a name narrows it. */
const SHOWN = 8;

/** A sale at the gate: crates of eggs, or of cracked eggs, to a walk-in or a registered buyer. */
export function SellEggs({ S }: { S: ErpData }) {
  const { online } = useFarm();
  const today = farmDay();
  const [day, setDay] = useState(today);
  const [product, setProduct] = useState<typeof EGGS | typeof CRACKED>(EGGS);
  const [who, setWho] = useState<"walkIn" | "buyer">("walkIn");
  const [walkIn, setWalkIn] = useState("");
  const [cust, setCust] = useState<number | null>(null);
  const [find, setFind] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const { busy, message, send, problem } = useSend();

  const eggs = product === EGGS;
  const isAdmin = canAct(S.viewer.grants, "eggsales", "admin");
  const buyers = S.customers.filter((c) => !c.archived);
  const buyer = who === "buyer" ? buyers.find((c) => c.id === cust) : undefined;
  const matches = buyers.filter((c) => c.name.toLowerCase().includes(find.trim().toLowerCase()));
  const inStore = eggs ? eggStock(S.eggMoves, S.invoices) : Math.floor(Math.max(0, crackedInStore(S.prodLog, S.invoices, S.eggsPerCrate, S.eggMoves)) / S.eggsPerCrate);
  // Eggs sell at the crate price (the buyer's own, if they have one); cracks at a price agreed each time.
  const unitPrice = eggs ? (num(price) > 0 && isAdmin ? num(price) : (buyer?.price ?? S.cratePrice)) : num(price);

  const save = () => {
    const n = num(qty);
    if (who === "walkIn" && !walkIn.trim()) return problem("Enter the walk-in buyer's name.");
    if (who === "buyer" && !buyer) return problem("Choose the buyer.");
    if (!Number.isInteger(n) || n <= 0) return problem("Enter a whole number of crates.");
    if (!eggs && !(num(price) > 0)) return problem("Enter the price per crate.");
    if (eggs && !unitPrice) return problem("The crate price hasn't been set. An admin sets it on the website (Layers → Sales).");
    // With no signal the store figure may be old, so the website decides when the entry arrives.
    if (online && n > inStore) return problem(`Only ${fmtK(inStore)} crates ${eggs ? "" : "of cracked eggs "}in store.`);
    const name = buyer?.name ?? walkIn.trim();
    const input = {
      cust: buyer?.id ?? null,
      walkIn: buyer ? "" : walkIn.trim(),
      product,
      qty: n,
      // Eggs carry a price only when an admin sets one; cracks always do.
      price: eggs ? (num(price) > 0 && isAdmin ? num(price) : undefined) : num(price),
      date: day,
    };
    const detail = `${dayName(day, today)} · ${fmtK(n)} crates${eggs ? "" : " cracked"} to ${name} · ${fmtN(n * unitPrice)}`;
    void send("addInvoice", input, { title: "Sale", detail }, () => {
      setQty("");
      setPrice("");
      setWalkIn("");
      setCust(null);
      setFind("");
    });
  };

  return (
    <>
      <Card>
        <DayChips today={today} value={day} onChange={setDay} />
        <Chips
          label="What's being sold"
          value={product}
          onChange={(p) => {
            setProduct(p);
            setPrice("");
          }}
          options={[
            { value: EGGS, label: "Eggs" },
            { value: CRACKED, label: "Cracked eggs" },
          ]}
        />
        <Figure label={eggs ? "Crates in store" : "Crates of cracked eggs in store"} value={fmtK(inStore)} />
      </Card>

      <Card>
        <Chips
          label="Buyer"
          value={who}
          onChange={setWho}
          options={[
            { value: "walkIn", label: "Walk-in" },
            { value: "buyer", label: "Registered buyer" },
          ]}
        />
        {who === "walkIn" ? (
          <Field label="Walk-in buyer's name" kind="text" value={walkIn} onChange={setWalkIn} />
        ) : buyer ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: font.body + 1, fontWeight: "700", color: color.ink }}>{buyer.name}</Text>
              {buyer.phone ? <Text style={{ fontSize: font.small, color: color.muted }}>{buyer.phone}</Text> : null}
            </View>
            <Button kind="quiet" label="Change" onPress={() => setCust(null)} />
          </View>
        ) : buyers.length === 0 ? (
          <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>No registered buyers yet. Add them on the website (Customers).</Text>
        ) : (
          <>
            {buyers.length > SHOWN ? <Field label="Find a buyer" kind="text" value={find} onChange={setFind} placeholder="Type a name" /> : null}
            <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.sm, borderCurve: "continuous", overflow: "hidden" }}>
              {matches.slice(0, SHOWN).map((c, i) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => setCust(c.id)}
                  android_ripple={{ color: color.brandSoft }}
                  style={{ minHeight: 50, paddingHorizontal: space.md, justifyContent: "center", borderTopWidth: i ? 1 : 0, borderTopColor: color.line, backgroundColor: "#ffffff" }}>
                  <Text style={{ fontSize: font.body, fontWeight: "600", color: color.ink }}>{c.name}</Text>
                </Pressable>
              ))}
              {matches.length === 0 ? <Text style={{ padding: space.md, fontSize: font.label, color: color.muted }}>No buyer by that name.</Text> : null}
            </View>
            {matches.length > SHOWN ? <Text style={{ fontSize: font.small, color: color.muted }}>{`${matches.length - SHOWN} more — type a name to find them.`}</Text> : null}
          </>
        )}
      </Card>

      <Card>
        <CardTitle>How many</CardTitle>
        <Field label="Crates" value={qty} onChange={setQty} />
        {eggs && !isAdmin ? null : (
          <Field
            label="Price per crate ₦"
            value={price}
            onChange={setPrice}
            placeholder={eggs && unitPrice ? String(buyer?.price ?? S.cratePrice) : "0"}
            hint={eggs ? "Leave empty to sell at the crate price." : undefined}
          />
        )}
        <Figure label="Price per crate" value={unitPrice ? fmtN(unitPrice) : "—"} />
        <Figure label="Total" value={fmtN(num(qty) * unitPrice || 0)} />
      </Card>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label="Record sale" onPress={save} busy={busy} />
    </>
  );
}
