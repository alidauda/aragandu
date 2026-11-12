import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { canAct } from "@farm/access";
import { saleAreaOf } from "@farm/erp/broilers";
import { balance, fmtD, fmtK, fmtN } from "@farm/erp/derive";
import type { ErpData, Invoice } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure } from "@/components/card";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { num } from "@/farm/day";
import { sendProof } from "@/farm/store";
import { color, font, radius, space } from "@/theme";

/** How many sales the list shows at once; typing a name narrows it. */
const SHOWN = 8;
/** The website's limit on a receipt's size. */
const MAX_BYTES = 5 * 1024 * 1024;

type Photo = { uri: string; name: string; type: string; file?: File };

/** A buyer's payment receipt, photographed and attached to their unpaid sale for an admin to check. */
export function Receipts({ S }: { S: ErpData }) {
  const g = S.viewer.grants;
  const admin = canAct(g, "eggsales", "admin") || canAct(g, "money", "admin");
  const [find, setFind] = useState("");
  const [sale, setSale] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  // Unpaid sales of what this person sells, newest first.
  const unpaid = S.invoices
    .filter((v) => v.status === "pending" && balance(v) > 0 && (admin || canAct(g, saleAreaOf(v.product), "staff")))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const matches = unpaid.filter((v) => v.name.toLowerCase().includes(find.trim().toLowerCase()));
  const sentFor = (id: number) => S.proofs.filter((p) => p.invoiceId === id && p.status !== "rejected").length;

  const choose = (v: Invoice) => {
    setSale(v);
    setAmount(String(balance(v)));
    setReference("");
    setPhoto(null);
    setMessage(null);
  };

  const pick = async (from: "camera" | "library") => {
    setMessage(null);
    if (from === "camera") {
      const allowed = await ImagePicker.requestCameraPermissionsAsync();
      if (!allowed.granted) return setMessage({ tone: "bad", text: "Allow the camera for Argandu Farms in the phone's settings, or choose a photo instead." });
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
    const r = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const a = r.canceled ? null : r.assets[0];
    if (!a) return;
    if ((a.fileSize ?? 0) > MAX_BYTES) return setMessage({ tone: "bad", text: "That photo is over 5 MB — take a smaller one." });
    setPhoto({ uri: a.uri, name: a.fileName ?? "receipt.jpg", type: a.mimeType ?? "image/jpeg", file: a.file });
  };

  const upload = async () => {
    if (busy || !sale) return;
    const paid = num(amount);
    if (!(paid > 0) || !Number.isFinite(paid)) return setMessage({ tone: "bad", text: "Enter the amount paid." });
    if (!photo) return setMessage({ tone: "bad", text: "Take or choose a photo of the receipt." });
    const form = new FormData();
    // The browser build has the file itself; a phone attaches it by where it's kept.
    form.append("file", photo.file ?? ({ uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob));
    form.append("kind", "invoice");
    form.append("id", String(sale.id));
    form.append("amount", String(Math.round(paid)));
    form.append("reference", reference.trim());
    setBusy(true);
    setMessage(null);
    const r = await sendProof(form);
    setBusy(false);
    if (!r.ok) return setMessage({ tone: "bad", text: r.error });
    setMessage({ tone: "good", text: `Receipt for ${sale.name} uploaded ✓ An admin will check it.` });
    setSale(null);
    setPhoto(null);
  };

  if (sale) {
    return (
      <>
        <Card>
          <CardTitle sub={`${fmtD(sale.date)} · ${fmtK(sale.qty)} × ${sale.product}`}>{sale.name}</CardTitle>
          <Figure label="Still owed" value={fmtN(balance(sale))} />
          <Button kind="quiet" label="Choose another sale" onPress={() => setSale(null)} />
        </Card>
        <Card>
          <Field label="Amount paid ₦" value={amount} onChange={setAmount} />
          <Field label="Reference (optional)" kind="text" value={reference} onChange={setReference} placeholder="Transfer reference or teller number" />
          <Text style={{ fontSize: font.label, fontWeight: "600", color: photo ? color.good : color.body }}>{photo ? "Photo ready ✓" : "No photo yet"}</Text>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Button kind="quiet" label="Take a photo" onPress={() => void pick("camera")} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="quiet" label="Choose a photo" onPress={() => void pick("library")} />
            </View>
          </View>
        </Card>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Button label="Upload receipt" onPress={() => void upload()} busy={busy} />
      </>
    );
  }

  return (
    <>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Card>
        <CardTitle sub="Choose the sale the buyer has paid for.">Unpaid sales</CardTitle>
        {unpaid.length === 0 ? (
          <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>No unpaid sales.</Text>
        ) : (
          <>
            {unpaid.length > SHOWN ? <Field label="Find a buyer" kind="text" value={find} onChange={setFind} placeholder="Type a name" /> : null}
            <View style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.sm, borderCurve: "continuous", overflow: "hidden" }}>
              {matches.slice(0, SHOWN).map((v, i) => (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  onPress={() => choose(v)}
                  android_ripple={{ color: color.brandSoft }}
                  style={{ paddingHorizontal: space.md, paddingVertical: space.md, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: color.line, backgroundColor: "#ffffff" }}>
                  <Text style={{ fontSize: font.body, fontWeight: "700", color: color.ink }}>{v.name}</Text>
                  <Text style={{ fontSize: font.small, color: color.muted }}>
                    {`${fmtD(v.date)} · ${fmtK(v.qty)} × ${v.product} · owes ${fmtN(balance(v))}${sentFor(v.id) ? ` · ${sentFor(v.id)} receipt${sentFor(v.id) === 1 ? "" : "s"} sent` : ""}`}
                  </Text>
                </Pressable>
              ))}
              {matches.length === 0 ? <Text style={{ padding: space.md, fontSize: font.label, color: color.muted }}>No unpaid sale by that name.</Text> : null}
            </View>
            {matches.length > SHOWN ? <Text style={{ fontSize: font.small, color: color.muted }}>{`${matches.length - SHOWN} more — type a name to find them.`}</Text> : null}
          </>
        )}
      </Card>
    </>
  );
}
