"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD, stBadge } from "@/lib/erp/derive";
import {
  Badge,
  Card,
  CardTitle,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
} from "@/components/erp/Drawer";

export default function LayersHealth() {
  const S = useErp();
  const meds = S.invItems.filter((i) => i.cat === "medication");
  const itemName = (id: number) =>
    S.invItems.find((i) => i.id === id)?.name ?? "—";
  const itemUnit = (id: number) =>
    S.invItems.find((i) => i.id === id)?.unit ?? "";

  const [openVax, setOpenVax] = useState(false);
  const [vax, setVax] = useState({
    item: String(meds[0]?.id ?? ""),
    batch: S.batches[0]?.batch ?? "",
    house: S.houses[0]?.code ?? "",
    route: "Drinking water",
    qty: "",
  });

  const [openMed, setOpenMed] = useState(false);
  const [med, setMed] = useState({
    item: String(meds[0]?.id ?? ""),
    reason: "",
    batch: S.batches[0]?.batch ?? "",
    dosage: "",
    qty: "",
  });

  const saveVax = () => {
    S.addVaccination({
      item: +vax.item,
      batch: vax.batch,
      house: vax.house,
      route: vax.route,
      qtyUsed: parseFloat(vax.qty) || 0,
      status: "done",
    });
    setVax({ ...vax, qty: "" });
    setOpenVax(false);
  };

  const saveMed = () => {
    if (!med.reason.trim() || !med.dosage.trim()) return;
    S.addMedication({
      item: +med.item,
      reason: med.reason.trim(),
      batch: med.batch,
      dosage: med.dosage.trim(),
      qtyUsed: parseFloat(med.qty) || 0,
      status: "ongoing",
    });
    setMed({ ...med, reason: "", dosage: "", qty: "" });
    setOpenMed(false);
  };

  const batchOptions = S.batches
    .filter((b) => b.st === "active")
    .map((b) => ({ label: b.batch, value: b.batch }));

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Health"
        sub="Vaccination and medication, drawn from the central store"
        action={
          <>
            <NewButton onClick={() => setOpenVax(true)}>
              Record vaccination
            </NewButton>
            <NewButton onClick={() => setOpenMed(true)}>
              Record medication
            </NewButton>
          </>
        }
      />

      <Drawer
        open={openVax}
        onClose={() => setOpenVax(false)}
        title="Record vaccination"
        sub="A filled quantity draws the vaccine from central inventory"
        onSubmit={saveVax}
        submitLabel="Record vaccination"
      >
        <SelectField
          label="Vaccine (central store)"
          value={vax.item}
          onChange={(v) => setVax({ ...vax, item: v })}
          options={meds.map((m) => ({ label: m.name, value: String(m.id) }))}
        />
        <FieldRow>
          <SelectField
            label="Batch"
            value={vax.batch}
            onChange={(v) => setVax({ ...vax, batch: v })}
            options={batchOptions}
          />
          <SelectField
            label="House"
            value={vax.house}
            onChange={(v) => setVax({ ...vax, house: v })}
            options={S.houses.map((h) => ({ label: h.code, value: h.code }))}
          />
        </FieldRow>
        <FieldRow>
          <SelectField
            label="Route"
            value={vax.route}
            onChange={(v) => setVax({ ...vax, route: v })}
            options={["Drinking water", "Eye drop", "Injection"].map((r) => ({
              label: r,
              value: r,
            }))}
          />
          <TextField
            label="Quantity used"
            type="number"
            value={vax.qty}
            onChange={(v) => setVax({ ...vax, qty: v })}
            placeholder="18"
          />
        </FieldRow>
      </Drawer>

      <Drawer
        open={openMed}
        onClose={() => setOpenMed(false)}
        title="Record medication"
        sub="Drug picked from the central store, dosage in your words"
        onSubmit={saveMed}
        submitLabel="Record medication"
      >
        <SelectField
          label="Medication (central store)"
          value={med.item}
          onChange={(v) => setMed({ ...med, item: v })}
          options={meds.map((m) => ({ label: m.name, value: String(m.id) }))}
        />
        <TextField
          label="Reason"
          value={med.reason}
          onChange={(v) => setMed({ ...med, reason: v })}
          placeholder="Respiratory signs, cage row 4"
        />
        <FieldRow>
          <SelectField
            label="Batch"
            value={med.batch}
            onChange={(v) => setMed({ ...med, batch: v })}
            options={batchOptions}
          />
          <TextField
            label="Quantity used"
            type="number"
            value={med.qty}
            onChange={(v) => setMed({ ...med, qty: v })}
            placeholder="4"
          />
        </FieldRow>
        <TextField
          label="Dosage"
          value={med.dosage}
          onChange={(v) => setMed({ ...med, dosage: v })}
          placeholder="1 ml/L, 5 days"
        />
      </Drawer>

      <Card className="overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Vaccination</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Vaccine</Th>
              <Th>Batch</Th>
              <Th>House</Th>
              <Th>Route</Th>
              <Th right>Used</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {S.vaccinations.map((v, i) => {
                const b =
                  v.status === "done"
                    ? { bg: "#e8f2e5", fg: "#3f6f3a" }
                    : v.status === "due"
                      ? { bg: "#fdf3e0", fg: "#a06a0e" }
                      : { bg: "#fbe9e5", fg: "#b3402f" };
                return (
                  <TRow key={i}>
                    <Td>{fmtD(v.date)}</Td>
                    <Td className="font-semibold">{itemName(v.item)}</Td>
                    <Td>{v.batch}</Td>
                    <Td>{v.house}</Td>
                    <Td className="text-[#59614a]">{v.route}</Td>
                    <Td right>
                      {v.qtyUsed ? `${v.qtyUsed} ${itemUnit(v.item)}` : "—"}
                    </Td>
                    <Td>
                      <Badge label={v.status} bg={b.bg} fg={b.fg} />
                    </Td>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Medication</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Date</Th>
              <Th>Medication</Th>
              <Th>Reason</Th>
              <Th>Batch</Th>
              <Th>Dosage</Th>
              <Th right>Used</Th>
              <Th>Status</Th>
            </THead>
            <tbody>
              {S.medications.map((m, i) => {
                const b = stBadge(m.status === "completed" ? "paid" : "pending");
                return (
                  <TRow key={i}>
                    <Td>{fmtD(m.date)}</Td>
                    <Td className="font-semibold">{itemName(m.item)}</Td>
                    <Td>{m.reason}</Td>
                    <Td>{m.batch}</Td>
                    <Td className="text-[#59614a]">{m.dosage}</Td>
                    <Td right>
                      {m.qtyUsed ? `${m.qtyUsed} ${itemUnit(m.item)}` : "—"}
                    </Td>
                    <Td>
                      <Badge label={m.status} bg={b.bg} fg={b.fg} />
                    </Td>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
      <Note>
        Vaccines and drugs are picked from the central inventory register — a
        filled &quot;used&quot; quantity draws that stock down as a layers →
        used movement.
      </Note>
    </>
  );
}
