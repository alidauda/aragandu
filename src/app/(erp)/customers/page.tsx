"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { customerAggregates, fmtK, fmtN } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  TextField,
  FormError,
} from "@/components/erp/Drawer";
import { InviteLink } from "@/components/erp/InviteLink";
import {
  Badge,
  Card,
  Kpi,
  Note,
  PageHeader,
  Table,
  THead,
  TRow,
  Td,
  Th,
  EditButton,
} from "@/components/erp/ui";

export default function Customers() {
  const S = useErp();
  const agg = customerAggregates(S.customers, S.invoices, S.orders, S.weekStart);
  const receivables = agg.reduce((a, c) => a + c.owed, 0);
  const onHold = agg.filter((c) => c.hold).length;
  const allocated = agg.reduce((a, c) => a + c.alloc, 0);

  const [open, setOpen] = useState(false);

  // Admin: correct a buyer's details or weekly allocation.
  const [edit, setEdit] = useState<{ id: number; name: string; phone: string; alloc: string } | null>(null);
  const [editError, setEditError] = useState("");
  const saveEdit = async () => {
    if (!edit) return;
    const alloc = Number(edit.alloc);
    if (!edit.name.trim()) return setEditError("Enter the buyer's name.");
    if (!Number.isInteger(alloc) || alloc < 0) return setEditError("Weekly crates must be a whole number.");
    setEditError("");
    const r = await S.updateCustomer({ id: edit.id, name: edit.name.trim(), phone: edit.phone.trim(), alloc });
    if (!r.ok) return setEditError(r.error);
    setEdit(null);
  };
  const [form, setForm] = useState({ name: "", phone: "", alloc: "", email: "" });

  // Portal access is by invite link: staff enter the email, copy the link,
  // and the buyer picks their own password.
  const [inviteFor, setInviteFor] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [invitePath, setInvitePath] = useState("");
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
  };

  const [newError, setNewError] = useState("");
  const [newPath, setNewPath] = useState("");

  const startNew = () => {
    setForm({ name: "", phone: "", alloc: "", email: "" });
    setNewError("");
    setNewPath("");
    setOpen(true);
  };

  const save = async () => {
    if (newPath) return setOpen(false);
    const alloc = parseInt(form.alloc, 10);
    if (!form.name.trim()) return setNewError("Enter the buyer's name.");
    if (!alloc || alloc <= 0) return setNewError("Enter weekly crates above 0.");
    setNewError("");
    const r = await S.addCustomer({
      name: form.name.trim(),
      phone: form.phone.trim(),
      alloc,
      email: form.email.trim(),
    });
    if (!r.ok) return setNewError(r.error);
    // With an email, keep the drawer open to show the invite link.
    if (r.data.path) setNewPath(r.data.path);
    else setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Customers"
        sub="Every buyer is one record — debt, history and portal access"
        action={<NewButton onClick={startNew}>New buyer</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New buyer"
        sub={
          newPath
            ? `${form.name.trim()} added — now send them their portal link`
            : "One record for debt, history and the portal login"
        }
        onSubmit={() => void save()}
        submitLabel={newPath ? "Done" : form.email.trim() ? "Add buyer & create invite" : "Add buyer"}
      >
        {newPath ? (
          <InviteLink path={newPath} email={form.email.trim().toLowerCase()} />
        ) : (
          <>
            <TextField
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Kano Fresh Foods"
            />
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
            <TextField
              label="Email for portal login (optional)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="orders@business.com"
            />
            <div className="-mt-2 text-[12px] text-[#8b958d]">
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
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={inviteFor !== null}
        onClose={() => setInviteFor(null)}
        title="Invite to the portal"
        sub={`${inviteCustomer?.name ?? "This buyer"} sets their own password from the link`}
        onSubmit={() => void sendInvite()}
        submitLabel={invitePath ? "Done" : "Create invite link"}
      >
        {invitePath ? (
          <InviteLink path={invitePath} email={inviteEmail.trim().toLowerCase()} />
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

      <Card className="mt-4 overflow-hidden">
        <Table>
          <THead>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th right>Weekly crates</Th>
            <Th right>Used this week</Th>
            <Th right>Outstanding</Th>
            <Th right>Lifetime purchases</Th>
            <Th>Standing</Th>
            <Th>Portal login</Th>
          </THead>
          <tbody>
            {agg.map((c) => {
              const b = c.hold
                ? { bg: "#fbeae7", fg: "#c7402f" }
                : { bg: "#e7f4ea", fg: "#23753a" };
              return (
                <TRow key={c.id}>
                  <Td className="font-semibold">
                    {c.name}
                    <EditButton
                      onClick={() => {
                        setEdit({ id: c.id, name: c.name, phone: c.phone, alloc: String(c.alloc) });
                        setEditError("");
                      }}
                    />
                  </Td>
                  <Td className="text-[#4c5a51]">{c.phone}</Td>
                  <Td right>{c.alloc}</Td>
                  <Td right>{c.used}</Td>
                  <Td
                    right
                    className="font-semibold"
                  >
                    <span style={{ color: c.owed ? "#9a6a12" : "#8b958d" }}>
                      {c.owed ? fmtN(c.owed) : "—"}
                    </span>
                  </Td>
                  <Td right>{fmtN(c.lifetime)}</Td>
                  <Td>
                    <Badge
                      label={c.hold ? "debt hold" : "good standing"}
                      bg={b.bg}
                      fg={b.fg}
                    />
                  </Td>
                  <Td className="text-[#4c5a51]">
                    {c.logins.length ? (
                      c.logins.map((l) => (
                        <div key={l.userId} className="flex items-center gap-2">
                          <span className={l.disabled ? "line-through opacity-60" : ""}>
                            {l.email}
                          </span>
                          {S.isAdmin ? (
                            <button
                              onClick={() => {
                                const q = l.disabled
                                  ? `Restore portal access for ${l.email}?`
                                  : `Remove portal access for ${l.email}? They're signed out and can't order.`;
                                if (window.confirm(q)) void S.setUserDisabled(l.userId, !l.disabled);
                              }}
                              disabled={S.saving}
                              className="text-[11.5px] font-semibold text-[#b3473a] opacity-70 hover:opacity-100"
                            >
                              {l.disabled ? "restore" : "remove"}
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <>
                        {pendingFor(c.id) ? (
                          <span className="mr-2 text-[12px]">
                            Invited · {pendingFor(c.id)!.email}
                          </span>
                        ) : null}
                        <button
                          onClick={() => openInvite(c.id)}
                          className="rounded-lg border border-[#dce1da] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#2f8f46]"
                        >
                          {pendingFor(c.id) ? "New link" : "Invite"}
                        </button>
                      </>
                    )}
                  </Td>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Note>
        Debt, order history and the portal login all hang off one customer
        record. Walk-in sales keep a name snapshot only.
      </Note>
    </>
  );
}
