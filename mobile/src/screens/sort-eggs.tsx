import { useState } from "react";

import { crackedInStore, eggStock, fmtEggs, fmtK, ungradedEggs } from "@farm/erp/derive";
import type { ErpData } from "@farm/erp/types";

import { Button } from "@/components/button";
import { Card, CardTitle, Figure } from "@/components/card";
import { DayChips } from "@/components/day-chips";
import { Field, FieldRow } from "@/components/field";
import { Notice } from "@/components/notice";
import { dayName, farmDay, num } from "@/farm/day";
import { useFarm } from "@/farm/store";
import { useSend } from "@/hooks/use-send";
import { color, font } from "@/theme";
import { Text } from "@/components/text";

/** Sorting collected eggs into the store: good crates, and what cracked on the way. */
export function SortEggs({ S }: { S: ErpData }) {
  const { online } = useFarm();
  const today = farmDay();
  const [day, setDay] = useState(today);
  const [crates, setCrates] = useState("");
  const [crackCrates, setCrackCrates] = useState("");
  const [crackPieces, setCrackPieces] = useState("");
  const { busy, message, send, problem } = useSend();
  const per = S.eggsPerCrate;
  const ungraded = ungradedEggs(S.prodLog, S.eggMoves, per);
  const cracked = crackedInStore(S.prodLog, S.invoices, per, S.eggMoves);

  const save = () => {
    const [n, cc, cp] = [crates, crackCrates, crackPieces].map(num);
    if (![n, cc, cp].every((x) => Number.isInteger(x) && x >= 0)) return problem("Enter whole numbers.");
    const cracks = cc * per + cp;
    if (n + cracks <= 0) return problem("Enter the good crates, the cracks, or both.");
    // With no signal the figure may be old, so the website decides when the entry arrives.
    if (online && n * per + cracks > ungraded) return problem(`Only ${fmtEggs(Math.max(0, ungraded), per)} are waiting to be sorted.`);
    const detail = [dayName(day, today), n ? `${fmtK(n)} good crates` : null, cracks ? `${fmtEggs(cracks, per)} cracked` : null].filter(Boolean).join(" · ");
    void send("addEggMove", { type: "in", crates: n, cracked: cracks, reason: "", date: day }, { title: "Eggs sorted", detail }, () => {
      setCrates("");
      setCrackCrates("");
      setCrackPieces("");
    });
  };

  return (
    <>
      <Card>
        <Figure label="Eggs not yet sorted" value={fmtEggs(Math.max(0, ungraded), per)} />
        <Figure label="Good crates in store" value={`${fmtK(eggStock(S.eggMoves, S.invoices))} crates`} />
        <Figure label="Cracked in store" value={fmtEggs(Math.max(0, cracked), per)} />
      </Card>
      <Card>
        <CardTitle sub="Count the good crates into the store, and any that cracked on the way.">Sort into the store</CardTitle>
        <DayChips today={today} value={day} onChange={setDay} />
        <Field label="Good crates" value={crates} onChange={setCrates} />
        <FieldRow>
          <Field label="Cracked crates" value={crackCrates} onChange={setCrackCrates} />
          <Field label="Cracked pieces" value={crackPieces} onChange={setCrackPieces} />
        </FieldRow>
        <Text style={{ fontSize: font.small, color: color.muted }}>{`A crate holds ${per} eggs.`}</Text>
      </Card>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button label="Record sorting" onPress={save} busy={busy} />
    </>
  );
}
