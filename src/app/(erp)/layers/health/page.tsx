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
  DeleteButton,
} from "@/components/erp/ui";
import {
  Drawer,
  FieldRow,
  FormError,
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

  const active = S.batches.filter((b) => b.st === "active");
  const batchOptions = active.map((b) => ({ label: b.batch, value: b.batch }));
  // What each select shows is what gets sent: fall back to the first option.
  const pickItem = (id: string) => meds.find((m) => m.id === +id) ?? meds[0];
  const pickBatch = (code: string) => active.find((b) => b.batch === code) ?? active[0];

  const [openVax, setOpenVax] = useState(false);
  const [vaxError, setVaxError] = useState("");
  const [vax, setVax] = useState({
    item: "",
    batch: "",
    house: "",
    route: "Drinking water",
    qty: "",
    status: "done",
  });
  const vaxItem = pickItem(vax.item);
  const vaxBatch = pickBatch(vax.batch);
  // The house defaults to where the batch lives.
  const vaxHouse = S.houses.some((h) => h.code === vax.house)
    ? vax.house
    : vaxBatch && vaxBatch.house !== "—"
      ? vaxBatch.house
      : (S.houses[0]?.code ?? "");

  const [openMed, setOpenMed] = useState(false);
  const [medError, setMedError] = useState("");
  const [med, setMed] = useState({
    item: "",
    reason: "",
    batch: "",
    dosage: "",
    qty: "",
  });
  const medItem = pickItem(med.item);
  const medBatch = pickBatch(med.batch);

  const saveVax = async () => {
    const qty = vax.qty.trim() ? Number(vax.qty) : 0;
    const done = vax.status === "done";
    if (!vaxItem) return setVaxError("Add a medication item to the central store first.");
    if (!vaxBatch) return setVaxError("There's no active batch to vaccinate.");
    if (!vaxHouse) return setVaxError("Add a house first.");
    if (!Number.isFinite(qty) || qty < 0) return setVaxError("Quantity must be 0 or more.");
    if (done && qty <= 0) return setVaxError("Enter the quantity used.");
    setVaxError("");
    if (!(await S.addVaccination({
      item: vaxItem.id,
      batch: vaxBatch.batch,
      house: vaxHouse,
      route: vax.route,
      qtyUsed: done ? qty : 0,
      status: done ? "done" : "due",
    })).ok) return;
    setVax({ ...vax, qty: "" });
    setOpenVax(false);
  };

  const saveMed = async () => {
    const qty = med.qty.trim() ? Number(med.qty) : 0;
    if (!medItem) return setMedError("Add a medication item to the central store first.");
    if (!medBatch) return setMedError("There's no active batch to treat.");
    if (!med.reason.trim()) return setMedError("Enter the reason.");
    if (!med.dosage.trim()) return setMedError("Enter the dosage.");
    if (!Number.isFinite(qty) || qty < 0) return setMedError("Quantity must be 0 or more.");
    setMedError("");
    if (!(await S.addMedication({
      item: medItem.id,
      reason: med.reason.trim(),
      batch: medBatch.batch,
      dosage: med.dosage.trim(),
      qtyUsed: qty,
      status: "ongoing",
    })).ok) return;
    setMed({ ...med, reason: "", dosage: "", qty: "" });
    setOpenMed(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Layers"
        title="Health"
        sub="Vaccination and medication, drawn from the central store"
        action={
          <>
            <NewButton
              onClick={() => {
                setVaxError("");
                setOpenVax(true);
              }}
            >
              Record vaccination
            </NewButton>
            <NewButton
              onClick={() => {
                setMedError("");
                setOpenMed(true);
              }}
            >
              Record medication
            </NewButton>
          </>
        }
      />

      <Drawer
        open={openVax}
        onClose={() => setOpenVax(false)}
        title="Record vaccination"
        sub="A dose given draws the vaccine from the Layers store location"
        onSubmit={saveVax}
        submitLabel="Record vaccination"
      >
        <SelectField
          label="Vaccine (central store)"
          value={String(vaxItem?.id ?? "")}
          onChange={(v) => setVax({ ...vax, item: v })}
          options={meds.map((m) => ({ label: m.name, value: String(m.id) }))}
        />
        <FieldRow>
          <SelectField
            label="Batch"
            value={vaxBatch?.batch ?? ""}
            onChange={(v) => setVax({ ...vax, batch: v, house: "" })}
            options={batchOptions}
          />
          <SelectField
            label="House"
            value={vaxHouse}
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
          <SelectField
            label="Status"
            value={vax.status}
            onChange={(v) => setVax({ ...vax, status: v })}
            options={[
              { label: "Given today", value: "done" },
              { label: "Scheduled (due)", value: "due" },
            ]}
          />
        </FieldRow>
        {vax.status === "done" ? (
          <TextField
            label={`Quantity used${vaxItem ? ` (${vaxItem.unit})` : ""}`}
            type="number"
            value={vax.qty}
            onChange={(v) => setVax({ ...vax, qty: v })}
            placeholder="18"
          />
        ) : null}
        <FormError message={vaxError} />
      </Drawer>

      <Drawer
        open={openMed}
        onClose={() => setOpenMed(false)}
        title="Record medication"
        sub="Drawn from the Layers store location, dosage in your words"
        onSubmit={saveMed}
        submitLabel="Record medication"
      >
        <SelectField
          label="Medication (central store)"
          value={String(medItem?.id ?? "")}
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
            value={medBatch?.batch ?? ""}
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
        <FormError message={medError} />
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
              <Th right />
            </THead>
            <tbody>
              {S.vaccinations.map((v, i) => {
                const b =
                  v.status === "done"
                    ? { bg: "#e7f4ea", fg: "#23753a" }
                    : v.status === "due"
                      ? { bg: "#fcf2de", fg: "#9a6a12" }
                      : { bg: "#fbeae7", fg: "#c7402f" };
                return (
                  <TRow key={v.id}>
                    <Td>{fmtD(v.date)}</Td>
                    <Td className="font-semibold">{itemName(v.item)}</Td>
                    <Td>{v.batch}</Td>
                    <Td>{v.house}</Td>
                    <Td className="text-[#4c5a51]">{v.route}</Td>
                    <Td right>
                      {v.qtyUsed ? `${v.qtyUsed} ${itemUnit(v.item)}` : "—"}
                    </Td>
                    <Td>
                      <Badge label={v.status} bg={b.bg} fg={b.fg} />
                    </Td>
                    <Td right>
                      <DeleteButton kind="vaccination" id={v.id} what={`this vaccination (its doses go back to Layers)`} />
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
              <Th right />
            </THead>
            <tbody>
              {S.medications.map((m, i) => {
                const b = stBadge(m.status === "completed" ? "paid" : "pending");
                return (
                  <TRow key={m.id}>
                    <Td>{fmtD(m.date)}</Td>
                    <Td className="font-semibold">{itemName(m.item)}</Td>
                    <Td>{m.reason}</Td>
                    <Td>{m.batch}</Td>
                    <Td className="text-[#4c5a51]">{m.dosage}</Td>
                    <Td right>
                      {m.qtyUsed ? `${m.qtyUsed} ${itemUnit(m.item)}` : "—"}
                    </Td>
                    <Td>
                      <Badge label={m.status} bg={b.bg} fg={b.fg} />
                    </Td>
                    <Td right>
                      <DeleteButton kind="medication" id={m.id} what={`this medication record (its doses go back to Layers)`} />
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
