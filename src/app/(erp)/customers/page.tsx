"use client";

import Link from "next/link";
import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { customerAggregates, fmtD, fmtK, fmtN, receivablesAging } from "@/lib/erp/derive";
import { invNo } from "@/lib/orders";
import {
  DayField,
  Drawer,
  FieldRow,
  NewButton,
  SelectField,
  TextField,
  FormError,
} from "@/components/erp/Drawer";
import { CustomerTabs } from "@/components/erp/CustomerTabs";
import { InviteLink } from "@/components/erp/InviteLink";
import { ResetLink, SetPassword } from "@/components/erp/ResetLink";
import {
  Badge,
  Card,
  Kpi,
  Note,
  PageHeader,
  Recorded,
  Table,
  Td,
  Th,
  THead,
  TRow,
} from "@/components/erp/ui";

export default function Customers() {
  const S = useErp();
  // Recording money is for money admins (Accounts, a Layers admin, the owner).
  const money = S.canDo("money", "admin");
  // Removed (archived) buyers are hidden unless asked for; they keep their history.
  const [showRemoved, setShowRemoved] = useState(false);
  const all = customerAggregates(S.customers, S.invoices, S.orders, S.weekStart);
  const removedCount = all.filter((c) => c.archived).length;
  const agg = all.filter((c) => !c.archived);
  const listed = showRemoved ? all : agg;
  const [removeMsg, setRemoveMsg] = useState("");
  // One buyer's full picture and actions, from View.
  const [viewFor, setViewFor] = useState<number | null>(null);
  const viewing = all.find((c) => c.id === viewFor);
  const viewInvoices = S.invoices.filter((v) => v.cust === viewFor).slice(0, 6);
  const removeBuyer = async (c: (typeof all)[number]) => {
    const history =
      S.invoices.some((v) => v.cust === c.id) || S.orders.some((o) => o.cust === c.id) || c.credit !== 0;
    const q = history
      ? `${c.name} has orders, invoices or payments, so they'll be archived, not deleted: hidden from lists, their portal login turned off, unpaid orders released — every invoice and payment stays.${
          c.owed > 0 ? ` They still owe ${fmtN(c.owed)}.` : ""
        } Archive ${c.name}?`
      : `${c.name} has no orders, invoices or payments. Delete them completely, with any login and invite?`;
    if (!window.confirm(q)) return;
    const r = await S.removeCustomer(c.id);
    setRemoveMsg(r.ok ? (r.data.deleted ? `${c.name} deleted.` : `${c.name} archived — find them under Show removed.`) : "");
  };
  const receivables = agg.reduce((a, c) => a + c.owed, 0);
  const onHold = agg.filter((c) => c.hold).length;
  const allocated = agg.reduce((a, c) => a + c.alloc, 0);
  const credit = agg.reduce((a, c) => a + Math.max(0, c.credit), 0);
  const aging = receivablesAging(
    S.invoices.filter((v) => v.cust !== null),
    S.today
  );

  // Admin: money a buyer paid before there's an invoice for it.
  const [advance, setAdvance] = useState<{
    id: number;
    name: string;
    amount: string;
    method: "transfer" | "cash" | "pos";
    reference: string;
    date: string;
  } | null>(null);
  const [advanceError, setAdvanceError] = useState("");
  // Admin: credit paid back to the buyer (e.g. a paid order the farm couldn't fill).
  const [refund, setRefund] = useState<{ id: number; name: string; free: number; amount: string; method: "transfer" | "cash" | "pos"; reference: string } | null>(null);
  const [refundError, setRefundError] = useState("");
  const saveRefund = async () => {
    if (!refund) return;
    const amount = Number(refund.amount);
    if (!(amount > 0)) return setRefundError("Enter an amount above 0.");
    if (amount > refund.free) return setRefundError(`Only ${fmtN(refund.free)} of their credit is free to refund.`);
    setRefundError("");
    const r = await S.refundCredit({
      customerId: refund.id,
      amount,
      method: refund.method,
      reference: refund.reference.trim(),
    });
    if (!r.ok) return setRefundError(r.error);
    setRefund(null);
  };
  /** Credit holding paid orders the farm hasn't fulfilled. */
  const held = (customerId: number) =>
    S.orders
      .filter((o) => o.cust === customerId && o.status === "pending" && o.paidAt)
      .reduce((a, o) => a + o.crates * (o.price ?? 0), 0);
  const saveAdvance = async () => {
    if (!advance) return;
    const amount = Number(advance.amount);
    if (!(amount > 0)) return setAdvanceError("Enter an amount above 0.");
    setAdvanceError("");
    const r = await S.recordAdvance({
      customerId: advance.id,
      amount,
      method: advance.method,
      reference: advance.reference.trim(),
      date: advance.date || undefined,
    });
    if (!r.ok) return setAdvanceError(r.error);
    setAdvance(null);
  };

  const [open, setOpen] = useState(false);

  // Admin: correct a buyer's details, weekly allocation or their own crate price.
  const [edit, setEdit] = useState<{
    id: number;
    name: string;
    phone: string;
    alloc: string;
    price: string;
    staffReceipts: boolean;
  } | null>(null);
  const [editError, setEditError] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const alloc = Number(edit.alloc);
    if (!edit.name.trim()) return setEditError("Enter the buyer's name.");
    if (!Number.isInteger(alloc) || alloc < 0) return setEditError("Weekly crates must be a whole number.");
    const price = edit.price.trim() ? Number(edit.price) : null;
    if (price !== null && !(price > 0)) return setEditError("Enter a crate price above 0, or leave it empty.");
    setEditError("");
    const r = await S.updateCustomer({
      id: edit.id,
      name: edit.name.trim(),
      phone: edit.phone.trim(),
      alloc,
      price,
      staffReceipts: edit.staffReceipts,
    });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };
  const [form, setForm] = useState({ name: "", phone: "", alloc: "", email: "" });

  // Portal access is by invite link: emailed to the buyer when email is on
  // (staff can also copy it), and the buyer picks their own password.
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [invitePath, setInvitePath] = useState("");
  const [inviteEmailed, setInviteEmailed] = useState(false);
  const inviteCustomer = S.customers.find((c) => c.id === inviteFor);
  const pendingFor = (customerId: number) =>
    S.invites.find((i) => i.role === "customer" && i.customerId === customerId);

  const openInvite = (customerId: number) => {
    setInviteFor(customerId);
    setInviteEmail(pendingFor(customerId)?.email ?? "");
    setInviteError("");
    setInvitePath("");
  };

  const sendInvite = async () => {
    if (invitePath) {
      setInviteFor(null);
      return;
    }
    if (inviteFor === null || !inviteEmail.trim()) return;
    setInviteError("");
    const r = await S.inviteBuyer({ customerId: inviteFor, email: inviteEmail.trim() });
    if (!r.ok) {
      setInviteError(r.error);
      return;
    }
    setInvitePath(r.data.path);
    setInviteEmailed(r.data.emailed);
  };

  const [newError, setNewError] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newEmailed, setNewEmailed] = useState(false);

  const startNew = () => {
    setForm({ name: "", phone: "", alloc: "", email: "" });
    setNewError("");
    setNewPath("");
    setOpen(true);
  };

  const save = async () => {
    if (newPath) return setOpen(false);
    // Only an admin sets the allocation; staff-added buyers start at 0.
    const alloc = S.isAdmin ? parseInt(form.alloc, 10) : 0;
    if (!form.name.trim()) return setNewError("Enter the buyer's name.");
    if (S.isAdmin && (!alloc || alloc <= 0)) return setNewError("Enter weekly crates above 0.");
    setNewError("");
    const r = await S.addCustomer({
      name: form.name.trim(),
      phone: form.phone.trim(),
      alloc,
      email: form.email.trim(),
    });
    if (!r.ok) return setNewError(r.error);
    // With an email, keep the drawer open to show the invite link.
    if (r.data.path) {
      setNewPath(r.data.path);
      setNewEmailed(Boolean(r.data.emailed));
    } else setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Customers"
        sub="Every buyer is one record — debt, history and portal access"
        action={
          <>
            {removedCount ? (
              <label className="flex items-center gap-2 text-[13px] text-[#465657]">
                <input
                  type="checkbox"
                  checked={showRemoved}
                  onChange={(e) => setShowRemoved(e.target.checked)}
                  className="accent-[#055a5b]"
                />
                Show removed ({removedCount})
              </label>
            ) : null}
            {S.canDo("eggsales") ? <NewButton onClick={startNew}>New buyer</NewButton> : null}
          </>
        }
      />
      <CustomerTabs />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New buyer"
        sub={
          newPath
            ? `${form.name.trim()} added${newEmailed ? " and invited by email" : " — now send them their portal link"}`
            : "One record for debt, history and the portal login"
        }
        onSubmit={() => void save()}
        submitLabel={newPath ? "Done" : form.email.trim() ? (S.emailEnabled ? "Add buyer & email invite" : "Add buyer & create invite") : "Add buyer"}
      >
        {newPath ? (
          <InviteLink path={newPath} email={form.email.trim().toLowerCase()} emailed={newEmailed} />
        ) : (
          <>
            <TextField
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Kano Fresh Foods"
            />
            {S.isAdmin ? (
              <FieldRow>
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="0801 234 5678"
                />
                <TextField
                  label="Weekly crates"
                  type="number"
                  value={form.alloc}
                  onChange={(v) => setForm({ ...form, alloc: v })}
                  placeholder="30"
                />
              </FieldRow>
            ) : (
              <>
                <TextField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="0801 234 5678"
                />
                <div className="-mt-2 text-[12px] text-[#84908f]">
                  The buyer can&apos;t order until an admin sets their weekly crates.
                </div>
              </>
            )}
            <TextField
              label="Email for portal login (optional)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="orders@business.com"
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">
              Add it now to get their invite link straight away, or invite them later.
            </div>
            {newError ? <div className="text-[12.5px] text-[#c7402f]">{newError}</div> : null}
          </>
        )}
      </Drawer>

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit buyer"
        sub="A new weekly allocation applies to this week straight away"
        onSubmit={() => void saveEdit()}
        submitLabel="Save"
      >
        {edit ? (
          <>
            <TextField label="Name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
            <FieldRow>
              <TextField label="Phone" value={edit.phone} onChange={(v) => setEdit({ ...edit, phone: v })} />
              <TextField
                label="Weekly crates"
                type="number"
                value={edit.alloc}
                onChange={(v) => setEdit({ ...edit, alloc: v })}
              />
            </FieldRow>
            <TextField
              label="Their crate price ₦"
              type="number"
              value={edit.price}
              onChange={(v) => setEdit({ ...edit, price: v })}
              placeholder={S.cratePrice ? `${S.cratePrice} (farm price)` : "farm price"}
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">
              Leave empty to use the farm&apos;s crate price{S.cratePrice ? ` (${fmtN(S.cratePrice)})` : ""}. A new
              price applies to their next orders and sales; orders already placed keep theirs.
            </div>
            <label className="flex items-start gap-2.5 rounded-xl border border-[#e4eaea] px-3 py-2.5">
              <input
                type="checkbox"
                checked={edit.staffReceipts}
                onChange={(e) => setEdit({ ...edit, staffReceipts: e.target.checked })}
                className="mt-0.5 accent-[#055a5b]"
              />
              <span>
                <span className="block text-[14px] font-semibold text-[#0d1d1d]">
                  Sales staff can upload payment receipts for them
                </span>
                <span className="block text-[12.5px] text-[#5d6b6b]">
                  Off: only the buyer (from their portal) and admins. Admins can always upload one.
                </span>
              </span>
            </label>
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={advance !== null}
        onClose={() => setAdvance(null)}
        title="Record advance"
        sub={`Held as ${advance?.name ?? "the buyer"}'s credit and drawn against their invoices`}
        onSubmit={() => void saveAdvance()}
        submitLabel="Record advance"
      >
        {advance ? (
          <>
            <FieldRow>
              <TextField
                label="Amount (₦)"
                type="number"
                value={advance.amount}
                onChange={(v) => setAdvance({ ...advance, amount: v })}
                placeholder="250000"
              />
              <SelectField
                label="Method"
                value={advance.method}
                onChange={(v) => setAdvance({ ...advance, method: v as "transfer" | "cash" | "pos" })}
                options={[
                  { label: "Transfer", value: "transfer" },
                  { label: "Cash", value: "cash" },
                  { label: "POS", value: "pos" },
                ]}
              />
            </FieldRow>
            <TextField
              label="Reference (optional)"
              value={advance.reference}
              onChange={(v) => setAdvance({ ...advance, reference: v })}
              placeholder="Bank ref or receipt no."
            />
            <DayField
              label="Received on"
              value={advance.date}
              onChange={(v) => setAdvance({ ...advance, date: v })}
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">
              Anything they already owe is settled from it first, oldest invoice first.
            </div>
            <FormError message={advanceError} />
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={refund !== null}
        onClose={() => setRefund(null)}
        title="Refund credit"
        sub={refund ? `${refund.name} has ${fmtN(refund.free)} of free credit. Send the money first, then record it here.` : ""}
        onSubmit={() => void saveRefund()}
        submitLabel="Record refund"
      >
        {refund ? (
          <>
            <FieldRow>
              <TextField
                label="Amount (₦)"
                type="number"
                value={refund.amount}
                onChange={(v) => setRefund({ ...refund, amount: v })}
              />
              <SelectField
                label="Paid back by"
                value={refund.method}
                onChange={(v) => setRefund({ ...refund, method: v as "transfer" | "cash" | "pos" })}
                options={[
                  { label: "Transfer", value: "transfer" },
                  { label: "Cash", value: "cash" },
                  { label: "POS", value: "pos" },
                ]}
              />
            </FieldRow>
            <TextField
              label="Reference (optional)"
              value={refund.reference}
              onChange={(v) => setRefund({ ...refund, reference: v })}
              placeholder="Bank ref"
            />
            <div className="-mt-2 text-[12px] text-[#84908f]">
              Credit holding a paid order that hasn&apos;t been fulfilled can&apos;t be refunded — decline the order first.
            </div>
            <FormError message={refundError} />
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={inviteFor !== null}
        onClose={() => setInviteFor(null)}
        title="Invite to the portal"
        sub={`${inviteCustomer?.name ?? "This buyer"} sets their own password from the link`}
        onSubmit={() => void sendInvite()}
        submitLabel={invitePath ? "Done" : S.emailEnabled ? "Email invite" : "Create invite link"}
      >
        {invitePath ? (
          <InviteLink path={invitePath} email={inviteEmail.trim().toLowerCase()} emailed={inviteEmailed} />
        ) : (
          <>
            <TextField
              label="Buyer's email (their sign-in name)"
              type="email"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="orders@business.com"
            />
            {inviteError ? (
              <div className="text-[12.5px] text-[#c7402f]">{inviteError}</div>
            ) : null}
          </>
        )}
      </Drawer>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Kpi
          label="Customers"
          value={String(agg.length)}
          sub="portal + walk-in buyers"
        />
        <Kpi
          label="Buyer receivables"
          value={fmtN(receivables)}
          sub="pending invoices, excl. walk-ins"
          color="#9a6a12"
        />
        <Kpi
          label="On debt hold"
          value={String(onHold)}
          sub="unpaid pre-week invoices"
          color="#c7402f"
        />
        <Kpi
          label="Weekly crates allocated"
          value={fmtK(allocated)}
          sub="across portal customers"
          color="#3a8bd6"
        />
      </div>

      <div className="stagger mt-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Owed · this week" value={fmtN(aging.current)} sub="invoices up to 7 days old" />
        <Kpi label="Owed · 8–30 days" value={fmtN(aging.d30)} color="#9a6a12" sub="past the debt-hold line" />
        <Kpi label="Owed · 31–60 days" value={fmtN(aging.d60)} color="#c7402f" sub="chase these" />
        <Kpi
          label="Owed · over 60 days"
          value={fmtN(aging.over60)}
          color="#c7402f"
          sub={credit ? `${fmtN(credit)} held as buyer credit` : "no buyer credit held"}
        />
      </div>

      {removeMsg ? <p className="mt-4 rounded-xl bg-[#e2f0ed] px-4 py-2.5 text-[13.5px] text-[#016559]">{removeMsg}</p> : null}
      <Card className="mt-4 overflow-hidden">
        <Table>
          <THead>
            <Th>Customer</Th>
            <Th right>This week</Th>
            <Th right>Outstanding</Th>
            <Th right>Credit</Th>
            <Th>Standing</Th>
            <Th right />
          </THead>
          <tbody>
            {listed.map((c) => (
              <TRow key={c.id}>
                <Td className={c.archived ? "text-[#84908f]" : ""}>
                  <button type="button" onClick={() => setViewFor(c.id)} className="text-left font-semibold hover:text-[#055a5b]">
                    {c.name}
                  </button>
                  {c.archived ? (
                    <span className="ml-2 rounded-full bg-[#ebf0ef] px-2 py-0.5 text-[11px] font-semibold text-[#5d6b6b]">
                      removed
                    </span>
                  ) : null}
                  {c.price ? (
                    <span
                      title="Their own crate price"
                      className="ml-2 rounded-full bg-[#e8f1fb] px-2 py-0.5 text-[11px] font-semibold text-[#3a8bd6]"
                    >
                      {fmtN(c.price)}/crate
                    </span>
                  ) : null}
                  <div className="text-[12px] text-[#84908f]">
                    {[c.phone, c.logins.length ? "portal login" : pendingFor(c.id) ? "invited" : null].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Td>
                <Td right>
                  <span className="font-data">
                    {c.used} <span className="text-[#84908f]">/ {c.alloc}</span>
                  </span>
                  <div className="text-[11.5px] text-[#84908f]">crates</div>
                </Td>
                <Td right className="font-semibold">
                  <span style={{ color: c.owed ? "#9a6a12" : "#84908f" }}>{c.owed ? fmtN(c.owed) : "—"}</span>
                </Td>
                <Td right>
                  <span style={{ color: c.credit > 0 ? "#016559" : "#84908f" }}>
                    {c.credit > 0 ? fmtN(c.credit) : "—"}
                  </span>
                  {held(c.id) > 0 ? <div className="text-[11.5px] text-[#84908f]">{fmtN(held(c.id))} held</div> : null}
                </Td>
                <Td>
                  <Badge
                    label={c.hold ? "debt hold" : "good standing"}
                    bg={c.hold ? "#fbeae7" : "#e2f0ed"}
                    fg={c.hold ? "#c7402f" : "#016559"}
                  />
                </Td>
                <Td right>
                  <button
                    type="button"
                    onClick={() => setViewFor(c.id)}
                    className="rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
                  >
                    View
                  </button>
                </Td>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>

      <Drawer
        open={viewing !== undefined}
        onClose={() => setViewFor(null)}
        title={viewing?.name ?? ""}
        sub={viewing ? [viewing.phone, viewing.archived ? "removed — kept for the books" : null].filter(Boolean).join(" · ") : ""}
        onSubmit={() => setViewFor(null)}
        submitLabel="Done"
      >
        {viewing ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[#f4f6f5] px-4 py-3.5">
              {[
                ["This week", `${viewing.used} of ${viewing.alloc} crates`],
                ["Crate price", `${fmtN(viewing.price ?? S.cratePrice)}${viewing.price ? " (their own)" : ""}`],
                ["Outstanding", viewing.owed ? fmtN(viewing.owed) : "—"],
                [
                  "Credit",
                  viewing.credit > 0
                    ? `${fmtN(viewing.credit)}${held(viewing.id) ? ` (${fmtN(held(viewing.id))} held)` : ""}`
                    : "—",
                ],
                ["Bought, all time", fmtN(viewing.lifetime)],
                ["Standing", viewing.hold ? "debt hold" : "good standing"],
                ["Receipts uploaded by", viewing.staffReceipts ? "buyer, sales staff, admins" : "buyer, admins"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[12px] text-[#738080]">{k}</div>
                  <div className="text-[14px] font-semibold text-[#0d1d1d]">{v}</div>
                </div>
              ))}
            </div>
            <Recorded at={viewing.createdAt} />

            {S.isAdmin || money ? (
              <div className="flex flex-wrap gap-2">
                {S.isAdmin && !viewing.archived ? (
                  <ViewAction
                    onClick={() => {
                      setEdit({
                        id: viewing.id,
                        name: viewing.name,
                        phone: viewing.phone,
                        alloc: String(viewing.alloc),
                        price: viewing.price ? String(viewing.price) : "",
                        staffReceipts: viewing.staffReceipts,
                      });
                      setEditError("");
                      setViewFor(null);
                    }}
                  >
                    Edit details
                  </ViewAction>
                ) : null}
                {money && !viewing.archived ? (
                  <ViewAction
                    onClick={() => {
                      setAdvance({ id: viewing.id, name: viewing.name, amount: "", method: "transfer", reference: "", date: "" });
                      setAdvanceError("");
                      setViewFor(null);
                    }}
                  >
                    + Advance
                  </ViewAction>
                ) : null}
                {money && viewing.credit - held(viewing.id) > 0 ? (
                  <ViewAction
                    onClick={() => {
                      const free = viewing.credit - held(viewing.id);
                      setRefund({ id: viewing.id, name: viewing.name, free, amount: String(free), method: "transfer", reference: "" });
                      setRefundError("");
                      setViewFor(null);
                    }}
                  >
                    Refund credit
                  </ViewAction>
                ) : null}
                {S.isAdmin ? (
                  viewing.archived ? (
                    <ViewAction onClick={() => void S.restoreCustomer(viewing.id)}>Restore buyer</ViewAction>
                  ) : (
                    <ViewAction
                      danger
                      onClick={() => {
                        const c = viewing;
                        setViewFor(null);
                        void removeBuyer(c);
                      }}
                    >
                      Remove buyer
                    </ViewAction>
                  )
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">Portal login</div>
              {viewing.logins.length ? (
                viewing.logins.map((l) => (
                  <div key={l.userId} className="rounded-xl border border-[#e4eaea] px-3 py-2.5">
                    <div className={`text-[14px] ${l.disabled ? "line-through opacity-60" : "font-semibold"}`}>{l.email}</div>
                    {S.isAdmin ? (
                      <div className="mt-1 flex flex-wrap gap-3">
                        {!l.disabled ? (
                          <>
                            <ResetLink userId={l.userId} email={l.email} />
                            <SetPassword userId={l.userId} email={l.email} />
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            const q = l.disabled
                              ? `Restore portal access for ${l.email}?`
                              : `Remove portal access for ${l.email}? They're signed out and can't order.`;
                            if (window.confirm(q)) void S.setUserDisabled(l.userId, !l.disabled);
                          }}
                          disabled={S.saving}
                          className="text-[11.5px] font-semibold text-[#b3473a] opacity-70 hover:opacity-100"
                        >
                          {l.disabled ? "restore access" : "remove access"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-[#465657]">
                  {pendingFor(viewing.id) ? <span>Invited · {pendingFor(viewing.id)!.email}</span> : <span>No portal login yet.</span>}
                  {S.canDo("eggsales") && !viewing.archived ? (
                    <ViewAction
                      onClick={() => {
                        const id = viewing.id;
                        setViewFor(null);
                        openInvite(id);
                      }}
                    >
                      {pendingFor(viewing.id) ? "New link" : "Invite to the portal"}
                    </ViewAction>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-[#465657]">Recent invoices</span>
                <Link href="/layers/sales" className="text-[12px] font-semibold text-[#055a5b]">
                  All sales →
                </Link>
              </div>
              {viewInvoices.length === 0 ? (
                <div className="text-[13px] text-[#84908f]">No invoices yet.</div>
              ) : (
                viewInvoices.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border-t border-[#ebf0ef] py-2 text-[13.5px]">
                    <span>
                      <Link href={`/invoices/${v.id}`} className="font-medium text-[#055a5b] hover:underline">
                        {invNo(v.id)}
                      </Link>
                      <span className="block text-[12.5px] text-[#84908f]">
                        {fmtD(v.date)} · {v.qty} {v.unit || "crates"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{fmtN(v.qty * v.price)}</span>
                      <Badge
                        label={v.status === "paid" ? "paid" : "owing"}
                        bg={v.status === "paid" ? "#e2f0ed" : "#fcf2de"}
                        fg={v.status === "paid" ? "#016559" : "#9a6a12"}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </Drawer>
      <Note>
        Debt, credit, order history and the portal login all hang off one
        customer record. Money paid in advance or over an invoice becomes
        credit and is drawn against the buyer&apos;s next invoices
        automatically. Walk-in sales are cash only and keep a name snapshot.
      </Note>
    </>
  );
}

/** A button in a buyer's View panel. */
function ViewAction({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white px-3 py-1.5 text-[12.5px] font-semibold ${
        danger ? "border-[#f0cfc9] text-[#b3473a]" : "border-[#d6dfde] text-[#055a5b]"
      }`}
    >
      {children}
    </button>
  );
}
