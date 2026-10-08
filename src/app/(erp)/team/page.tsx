"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD } from "@/lib/erp/derive";
import { roleLabel, type TeamRole } from "@/lib/roles";
import { Drawer, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
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

const ROLE_HELP: Record<TeamRole, string> = {
  admin: "Everything, including money, settings, corrections and people",
  staff: "Day-to-day records; no money, settings, deletes or people",
};

export default function Team() {
  const S = useErp();
  const customerName = (id: number | null) =>
    S.customers.find((c) => c.id === id)?.name ?? "—";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; role: TeamRole }>({
    name: "",
    email: "",
    role: "staff",
  });
  const [error, setError] = useState("");
  const [path, setPath] = useState("");

  const start = () => {
    setForm({ name: "", email: "", role: "staff" });
    setError("");
    setPath("");
    setOpen(true);
  };

  const submit = async () => {
    if (path) return setOpen(false);
    if (!form.name.trim()) return setError("Enter their name.");
    if (!form.email.trim()) return setError("Enter their email.");
    setError("");
    const r = await S.inviteStaff({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    });
    if (!r.ok) return setError(r.error);
    setPath(r.data.path);
  };

  const toggleAccess = (userId: string, name: string, disabled: boolean) => {
    const question = disabled
      ? `Remove ${name}'s access? They're signed out at once and can't sign in; their records stay.`
      : `Restore ${name}'s access?`;
    if (window.confirm(question)) void S.setUserDisabled(userId, disabled);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Team"
        sub="Who can use the ERP, and what they can do"
        action={S.isAdmin ? <NewButton onClick={start}>Invite staff</NewButton> : undefined}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Invite to the team"
        sub="They choose their own password from the link"
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
            <SelectField
              label="Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as TeamRole })}
              options={[
                { label: "Staff", value: "staff" },
                { label: "Admin", value: "admin" },
              ]}
            />
            <div className="-mt-2 text-[12px] text-[#8a9070]">{ROLE_HELP[form.role]}</div>
            <FormError message={error} />
          </>
        )}
      </Drawer>

      <Card className="overflow-hidden">
        <div className="px-4 pt-3.5">
          <CardTitle>Team</CardTitle>
        </div>
        <div className="mt-2">
          <Table>
            <THead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Since</Th>
              <Th right />
            </THead>
            <tbody>
              {S.staff.map((m) => {
                const me = m.id === S.viewer.id;
                return (
                  <TRow key={m.id}>
                    <Td className="font-semibold">
                      <span className={m.disabled ? "text-[#8a9070] line-through" : ""}>
                        {m.name}
                      </span>
                      {me ? (
                        <span className="ml-2 text-[12px] font-normal text-[#8a9070]">you</span>
                      ) : null}
                      {m.disabled ? (
                        <span className="ml-2 text-[12px] font-normal text-[#b3402f]">
                          access removed
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-[#59614a]">{m.email}</Td>
                    <Td>
                      {S.isAdmin && !me && !m.disabled ? (
                        <select
                          value={m.role}
                          disabled={S.saving}
                          onChange={(e) => void S.setStaffRole(m.id, e.target.value as TeamRole)}
                          className="rounded-md border border-[#cfd3bd] bg-white px-1.5 py-1 text-[12.5px]"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge
                          label={roleLabel(m.role)}
                          bg={m.role === "admin" ? "#fdf3e0" : "#e8f2e5"}
                          fg={m.role === "admin" ? "#a06a0e" : "#3f6f3a"}
                        />
                      )}
                    </Td>
                    <Td>{fmtD(m.since)}</Td>
                    <Td right>
                      {S.isAdmin && !me ? (
                        <button
                          onClick={() => toggleAccess(m.id, m.name, !m.disabled)}
                          disabled={S.saving}
                          className={`rounded-lg border bg-white px-3 py-1.5 text-[12.5px] font-semibold ${
                            m.disabled
                              ? "border-[#cfd3bd] text-[#3c4d28]"
                              : "border-[#e2c9c3] text-[#8a5a52]"
                          }`}
                        >
                          {m.disabled ? "Restore access" : "Remove access"}
                        </button>
                      ) : null}
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
                      {i.role === "customer" ? customerName(i.customerId) : i.name}
                    </Td>
                    <Td>
                      <Badge
                        label={i.role === "customer" ? "buyer portal" : roleLabel(i.role)}
                        bg={i.role === "customer" ? "#e6f0f8" : "#e8f2e5"}
                        fg={i.role === "customer" ? "#2f7cb6" : "#3f6f3a"}
                      />
                    </Td>
                    <Td>{fmtD(i.expires)}</Td>
                    <Td right>
                      {S.isAdmin ? (
                        <button
                          onClick={() => S.revokeInvite(i.id)}
                          disabled={S.saving}
                          className="rounded-lg border border-[#e2c9c3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#8a5a52]"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </Td>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
      <Note>
        <strong>Admin</strong>: {ROLE_HELP.admin.toLowerCase()}. <strong>Staff</strong>:{" "}
        {ROLE_HELP.staff.toLowerCase()}. Invite links work once and expire after 7 days.
        Removing access signs the person out straight away and keeps everything they
        recorded.
      </Note>
    </>
  );
}
