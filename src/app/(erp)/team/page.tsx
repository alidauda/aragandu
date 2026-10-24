"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD } from "@/lib/erp/derive";
import { roleLabel, type TeamRole } from "@/lib/roles";
import { asScope, DIVISION_SCOPES, SCOPE_LABEL, scopeLabel, type DivisionScope } from "@/lib/access";
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
  const isOwner = S.viewer.owner;
  // Admins manage staff; only the owner manages admins; nobody changes the owner.
  const canManage = (m: { id: string; role: TeamRole; owner: boolean }) =>
    S.isAdmin && m.id !== S.viewer.id && !m.owner && (m.role === "staff" || isOwner);
  const customerName = (id: number | null) =>
    S.customers.find((c) => c.id === id)?.name ?? "—";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; role: TeamRole; division: string }>({
    name: "",
    email: "",
    role: "staff",
    division: "",
  });
  // Farm-wide admins place people in a division; a division admin's people join theirs.
  const placesPeople = S.isAdmin && S.scope === null;
  const divisionOptions = [
    { label: "Whole farm", value: "" },
    ...DIVISION_SCOPES.map((d) => ({ label: SCOPE_LABEL[d], value: d })),
  ];
  const [error, setError] = useState("");
  const [path, setPath] = useState("");
  const [emailed, setEmailed] = useState(false);

  const start = () => {
    setForm({ name: "", email: "", role: "staff", division: "" });
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
      role: isOwner ? form.role : "staff",
      division: placesPeople ? asScope(form.division) : null,
    });
    if (!r.ok) return setError(r.error);
    setPath(r.data.path);
    setEmailed(r.data.emailed);
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
        submitLabel={path ? "Done" : S.emailEnabled ? "Email invite" : "Create invite link"}
      >
        {path ? (
          <InviteLink path={path} email={form.email.trim().toLowerCase()} emailed={emailed} />
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
            {isOwner ? (
              <SelectField
                label="Role"
                value={form.role}
                onChange={(v) => setForm({ ...form, role: v as TeamRole })}
                options={[
                  { label: "Staff", value: "staff" },
                  { label: "Admin", value: "admin" },
                ]}
              />
            ) : null}
            <div className="-mt-2 text-[12px] text-[#84908f]">
              {isOwner ? ROLE_HELP[form.role] : `Joins as staff — ${ROLE_HELP.staff.toLowerCase()}. Only the owner can add admins.`}
            </div>
            {placesPeople ? (
              <>
                <SelectField
                  label="Division"
                  value={form.division}
                  onChange={(v) => setForm({ ...form, division: v })}
                  options={divisionOptions}
                />
                <div className="-mt-2 text-[12px] text-[#84908f]">
                  {form.division
                    ? `They'll only see ${SCOPE_LABEL[form.division as DivisionScope]} — its pages, its stock and its people.`
                    : "They'll see every division."}
                </div>
              </>
            ) : S.scope ? (
              <div className="text-[12.5px] text-[#465657]">They&apos;ll join {SCOPE_LABEL[S.scope]}.</div>
            ) : null}
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
              <Th>Division</Th>
              <Th>Since</Th>
              <Th right />
            </THead>
            <tbody>
              {S.staff.map((m) => {
                const me = m.id === S.viewer.id;
                return (
                  <TRow key={m.id}>
                    <Td className="font-semibold">
                      <span className={m.disabled ? "text-[#84908f] line-through" : ""}>
                        {m.name}
                      </span>
                      {m.owner ? (
                        <span className="ml-2 rounded-full bg-[#0d1d1d] px-2 py-0.5 text-[11px] font-semibold text-white">
                          Owner
                        </span>
                      ) : null}
                      {me ? (
                        <span className="ml-2 text-[12px] font-normal text-[#84908f]">you</span>
                      ) : null}
                      {m.disabled ? (
                        <span className="ml-2 text-[12px] font-normal text-[#c7402f]">
                          access removed
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-[#465657]">{m.email}</Td>
                    <Td>
                      {isOwner && canManage(m) && !m.disabled ? (
                        <select
                          value={m.role}
                          disabled={S.saving}
                          onChange={(e) => void S.setStaffRole(m.id, e.target.value as TeamRole)}
                          className="rounded-md border border-[#d6dfde] bg-white px-1.5 py-1 text-[12.5px]"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge
                          label={roleLabel(m.role)}
                          bg={m.role === "admin" ? "#fcf2de" : "#e2f0ed"}
                          fg={m.role === "admin" ? "#9a6a12" : "#016559"}
                        />
                      )}
                    </Td>
                    <Td>
                      {placesPeople && canManage(m) && !m.disabled ? (
                        <select
                          value={m.division ?? ""}
                          disabled={S.saving}
                          onChange={(e) => {
                            const to = asScope(e.target.value);
                            const q = `Move ${m.name} to ${scopeLabel(to)}? They'll be signed out and see only ${scopeLabel(to).toLowerCase()} from then on.`;
                            if (window.confirm(q)) void S.setUserDivision(m.id, to);
                          }}
                          className="rounded-md border border-[#d6dfde] bg-white px-1.5 py-1 text-[12.5px]"
                        >
                          {divisionOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[13px] text-[#465657]">{scopeLabel(m.division)}</span>
                      )}
                    </Td>
                    <Td>{fmtD(m.since)}</Td>
                    <Td right>
                      {canManage(m) ? (
                        <button
                          onClick={() => toggleAccess(m.id, m.name, !m.disabled)}
                          disabled={S.saving}
                          className={`rounded-lg border bg-white px-3 py-1.5 text-[12.5px] font-semibold ${
                            m.disabled
                              ? "border-[#d6dfde] text-[#055a5b]"
                              : "border-[#f0cfc9] text-[#b3473a]"
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
            <div className="px-4 pb-4 text-[13px] text-[#84908f]">
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
                    <Td className="text-[#465657]">
                      {i.role === "customer" ? customerName(i.customerId) : i.name}
                    </Td>
                    <Td>
                      <Badge
                        label={
                          i.role === "customer"
                            ? "buyer portal"
                            : `${roleLabel(i.role)}${i.division ? ` · ${SCOPE_LABEL[i.division].replace(" (chicken)", "")}` : ""}`
                        }
                        bg={i.role === "customer" ? "#e8f1fb" : "#e2f0ed"}
                        fg={i.role === "customer" ? "#3a8bd6" : "#016559"}
                      />
                    </Td>
                    <Td>{fmtD(i.expires)}</Td>
                    <Td right>
                      {S.isAdmin ? (
                        <button
                          onClick={() => S.revokeInvite(i.id)}
                          disabled={S.saving}
                          className="rounded-lg border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a]"
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
        {ROLE_HELP.staff.toLowerCase()}. Only the <strong>owner</strong> can add admins, change an
        admin&apos;s role or remove their access, and no one can change the owner. Invite links
        work once and expire after 7 days.
        Removing access signs the person out straight away and keeps everything they
        recorded.
      </Note>
    </>
  );
}
