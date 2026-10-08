"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD } from "@/lib/erp/derive";
import { Drawer, NewButton, TextField } from "@/components/erp/Drawer";
import { InviteLink } from "@/components/erp/InviteLink";
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

export default function Team() {
  const S = useErp();
  const customerName = (id: number | null) =>
    S.customers.find((c) => c.id === id)?.name ?? "—";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [error, setError] = useState("");
  const [path, setPath] = useState("");

  const start = () => {
    setForm({ name: "", email: "" });
    setError("");
    setPath("");
    setOpen(true);
  };

  const submit = async () => {
    if (path) {
      setOpen(false);
      return;
    }
    if (!form.name.trim() || !form.email.trim()) return;
    setError("");
    const r = await S.inviteStaff({ name: form.name.trim(), email: form.email.trim() });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPath(r.data.path);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Team"
        sub="Staff with ERP access, and invite links not yet used"
        action={<NewButton onClick={start}>Invite staff</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Invite staff"
        sub="They choose their own password from the link and get full ERP access"
        onSubmit={() => void submit()}
        submitLabel={path ? "Done" : "Create invite link"}
      >
        {path ? (
          <InviteLink path={path} email={form.email.trim().toLowerCase()} />
        ) : (
          <>
            <TextField
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Ada Okafor"
            />
            <TextField
              label="Email (their sign-in name)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="ada@argandu.farm"
            />
            {error ? <div className="text-[12.5px] text-[#b3402f]">{error}</div> : null}
          </>
        )}
      </Drawer>

      <Card className="overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Staff</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Since</Th>
            </THead>
            <tbody>
              {S.staff.map((m) => (
                <TRow key={m.id}>
                  <Td className="font-semibold">
                    {m.name}
                    {m.id === S.viewer.id ? (
                      <span className="ml-2 text-[12px] font-normal text-[#8a9070]">you</span>
                    ) : null}
                  </Td>
                  <Td className="text-[#59614a]">{m.email}</Td>
                  <Td>{fmtD(m.since)}</Td>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Pending invites</CardTitle>
        </div>
        <div className="mt-2">
          {S.invites.length === 0 ? (
            <div className="px-4 pb-4 text-[13px] text-[#8a9070]">
              No open invites. Buyers are invited from the Customers page.
            </div>
          ) : (
            <Table>
              <THead>
                <Th>Email</Th>
                <Th>For</Th>
                <Th>Access</Th>
                <Th>Expires</Th>
                <Th right />
              </THead>
              <tbody>
                {S.invites.map((i) => (
                  <TRow key={i.id}>
                    <Td className="font-semibold">{i.email}</Td>
                    <Td className="text-[#59614a]">
                      {i.role === "staff" ? i.name : customerName(i.customerId)}
                    </Td>
                    <Td>
                      <Badge
                        label={i.role === "staff" ? "staff" : "buyer portal"}
                        bg={i.role === "staff" ? "#e8f2e5" : "#e6f0f8"}
                        fg={i.role === "staff" ? "#3f6f3a" : "#2f7cb6"}
                      />
                    </Td>
                    <Td>{fmtD(i.expires)}</Td>
                    <Td right>
                      <button
                        onClick={() => S.revokeInvite(i.id)}
                        className="rounded-lg border border-[#e2c9c3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#8a5a52]"
                      >
                        Revoke
                      </button>
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
      <Note>
        Invite links work once and expire after 7 days. Only a fingerprint of each
        link is stored, so a lost link can&apos;t be shown again — create a new
        invite instead; it replaces the old one.
      </Note>
    </>
  );
}
