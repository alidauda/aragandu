"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD } from "@/lib/erp/derive";
import {
  DIVISION_SCOPES,
  FUNCTION_HELP,
  FUNCTION_LABEL,
  FUNCTION_ROLES,
  mayGrant,
  noRoles,
  roleLabels,
  SCOPE_LABEL,
  type DivisionScope,
  type FunctionRole,
  type Grants,
  type TeamLevel,
} from "@/lib/access";
import { Drawer, FormError, NewButton, TextField } from "@/components/erp/Drawer";
import { InviteLink } from "@/components/erp/InviteLink";
import { ResetLink, SetPassword } from "@/components/erp/ResetLink";
import { Badge, Card, CardTitle, Note, PageHeader, Table, THead, TRow, Td, Th } from "@/components/erp/ui";

type Roles = Omit<Grants, "owner">;
const EMPTY: Roles = { farm: null, divisions: {}, functions: [] };
const asRoles = (g: Grants): Roles => ({ farm: g.farm, divisions: { ...g.divisions }, functions: [...g.functions] });
const asGrantsOf = (r: Roles): Grants => ({ owner: false, ...r });

const LEVEL_HELP: Record<TeamLevel, string> = {
  admin: "everything there, including money, settings, corrections and its people",
  staff: "day-to-day records there; no settings, deletes or people",
};

/**
 * The roles form: a level in each division, the whole farm, and the
 * cross-division roles. Choices the viewer can't give are shown but off.
 */
function RolesEditor({ value, onChange }: { value: Roles; onChange: (r: Roles) => void }) {
  const S = useErp();
  const me = S.grants;
  // Could they give this set of roles? (The server checks the same.)
  const allowed = (r: Roles) => mayGrant(me, asGrantsOf(r));
  const setDivision = (d: DivisionScope, l: TeamLevel | null) => {
    const divisions = { ...value.divisions };
    if (l) divisions[d] = l;
    else delete divisions[d];
    onChange({ ...value, divisions });
  };
  const toggleFunction = (f: FunctionRole) =>
    onChange({
      ...value,
      functions: value.functions.includes(f) ? value.functions.filter((x) => x !== f) : [...value.functions, f],
    });

  const pill = (on: boolean, can: boolean) =>
    `rounded-lg border px-3 py-1.5 text-[12.5px] ${
      on
        ? "border-[#055a5b] bg-[#e3efee] text-[#044647]"
        : can
          ? "border-[#d6dfde] bg-white text-[#465657] hover:border-[#055a5b]"
          : "cursor-not-allowed border-[#ebf0ef] bg-[#f8faf9] text-[#c0cbca]"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 font-sub text-[14px] text-[#0d1d1d]">Divisions</div>
        <div className="flex flex-col gap-2">
          {DIVISION_SCOPES.map((d) => {
            const current = value.divisions[d] ?? null;
            return (
              <div key={d} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] text-[#0d1d1d]">{SCOPE_LABEL[d]}</span>
                <span className="flex gap-1.5">
                  {([null, "staff", "admin"] as const).map((l) => {
                    const next = { ...value, divisions: { ...value.divisions } };
                    if (l) next.divisions[d] = l;
                    else delete next.divisions[d];
                    const can = l === current || allowed(next);
                    return (
                      <button
                        key={l ?? "none"}
                        type="button"
                        disabled={!can}
                        onClick={() => setDivision(d, l)}
                        className={pill(current === l, can)}
                      >
                        {l === null ? "None" : l === "admin" ? "Admin" : "Staff"}
                      </button>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[12px] text-[#84908f]">
          Staff: {LEVEL_HELP.staff}. Admin: {LEVEL_HELP.admin}.
        </div>
      </div>

      <div>
        <div className="mb-1.5 font-sub text-[14px] text-[#0d1d1d]">Across the farm</div>
        <div className="flex flex-col gap-2">
          {FUNCTION_ROLES.map((f) => {
            const on = value.functions.includes(f);
            const can = on || allowed({ ...value, functions: [...value.functions, f] });
            return (
              <label
                key={f}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                  on ? "border-[#055a5b] bg-[#f3f8f7]" : "border-[#e4eaea]"
                } ${can ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!can}
                  onChange={() => toggleFunction(f)}
                  className="mt-0.5 accent-[#055a5b]"
                />
                <span>
                  <span className="block font-sub text-[14px] text-[#0d1d1d]">{FUNCTION_LABEL[f]}</span>
                  <span className="block text-[12.5px] text-[#5d6b6b]">{FUNCTION_HELP[f]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {S.farmWide ? (
        <div>
          <div className="mb-1.5 font-sub text-[14px] text-[#0d1d1d]">Whole farm</div>
          <div className="flex gap-1.5">
            {([null, "staff", "admin"] as const).map((l) => {
              const can = l === value.farm || allowed({ ...value, farm: l });
              return (
                <button
                  key={l ?? "none"}
                  type="button"
                  disabled={!can}
                  onClick={() => onChange({ ...value, farm: l })}
                  className={pill(value.farm === l, can)}
                >
                  {l === null ? "None" : l === "admin" ? "Admin of everything" : "Staff in everything"}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 text-[12px] text-[#84908f]">
            Every division at that level, plus the farm dashboard. Admin of everything also sees Activity and the
            email log.
          </div>
        </div>
      ) : null}

      {!S.viewer.owner ? (
        <div className="rounded-lg bg-[#f4f6f5] px-3 py-2 text-[12.5px] text-[#5d6b6b]">
          {S.farmWide
            ? "Only the owner can give admin roles."
            : "You can give staff roles in the divisions you run. The owner gives admin and farm-wide roles."}
        </div>
      ) : null}
    </div>
  );
}

function RoleBadges({ g }: { g: Grants }) {
  const labels = roleLabels(g).filter((l) => l !== "Owner");
  if (labels.length === 0) return <span className="text-[13px] text-[#84908f]">No roles</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => {
        const admin = / admin$/.test(l);
        return (
          <Badge
            key={l}
            label={l}
            bg={admin ? "#fcf2de" : "#e2f0ed"}
            fg={admin ? "#9a6a12" : "#016559"}
          />
        );
      })}
    </span>
  );
}

export default function Team() {
  const S = useErp();
  const me = S.grants;
  const customerName = (id: number | null) => S.customers.find((c) => c.id === id)?.name ?? "—";
  // Can they change this person? Not the owner, not yourself, only roles you could give.
  const canManage = (m: { id: string; owner: boolean; grants: Grants }) =>
    m.id !== S.viewer.id && !m.owner && mayGrant(me, m.grants);
  // Could they invite anyone at all? (Owner, farm-wide admins, division admins.)
  const canInvite = me.owner || me.farm === "admin" || Object.values(me.divisions).includes("admin");

  // ── Invite
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [roles, setRoles] = useState<Roles>(EMPTY);
  const [error, setError] = useState("");
  const [path, setPath] = useState("");
  const [emailed, setEmailed] = useState(false);

  const start = () => {
    setForm({ name: "", email: "" });
    // A division admin's invite starts as staff in their division.
    const mine = (Object.keys(me.divisions) as DivisionScope[]).filter((d) => me.divisions[d] === "admin");
    setRoles(S.farmWide || mine.length === 0 ? EMPTY : { ...EMPTY, divisions: { [mine[0]]: "staff" } });
    setError("");
    setPath("");
    setOpen(true);
  };

  const submit = async () => {
    if (path) return setOpen(false);
    if (!form.name.trim()) return setError("Enter their name.");
    if (!form.email.trim()) return setError("Enter their email.");
    if (noRoles(asGrantsOf(roles))) return setError("Give them at least one role.");
    setError("");
    const r = await S.inviteStaff({ name: form.name.trim(), email: form.email.trim(), roles });
    if (!r.ok) return setError(r.error);
    setPath(r.data.path);
    setEmailed(r.data.emailed);
  };

  // ── Edit someone's roles
  const [editing, setEditing] = useState<{ id: string; name: string; roles: Roles } | null>(null);
  const [editError, setEditError] = useState("");
  const saveRoles = async () => {
    if (!editing) return;
    if (noRoles(asGrantsOf(editing.roles))) {
      return setEditError("Give them at least one role — or remove their access instead.");
    }
    setEditError("");
    const r = await S.setUserGrants({ userId: editing.id, roles: editing.roles });
    if (!r.ok) return setEditError(r.error);
    setEditing(null);
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
        sub="Who can use the ERP, and what each person can do — one person can hold several roles"
        action={canInvite ? <NewButton onClick={start}>Invite someone</NewButton> : undefined}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Invite to the team"
        sub="Pick their roles — as many as they need. They choose their own password from the link."
        onSubmit={() => void submit()}
        submitLabel={path ? "Done" : S.emailEnabled ? "Email invite" : "Create invite link"}
      >
        {path ? (
          <InviteLink path={path} email={form.email.trim().toLowerCase()} emailed={emailed} />
        ) : (
          <>
            <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ada Okafor" />
            <TextField
              label="Email (their sign-in name)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="ada@argandufarms.com.ng"
            />
            <RolesEditor value={roles} onChange={setRoles} />
            <FormError message={error} />
          </>
        )}
      </Drawer>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Roles — ${editing?.name ?? ""}`}
        sub="Changes apply straight away, on their next click."
        onSubmit={() => void saveRoles()}
        submitLabel="Save roles"
      >
        {editing ? (
          <>
            <RolesEditor value={editing.roles} onChange={(r) => setEditing({ ...editing, roles: r })} />
            <FormError message={editError} />
          </>
        ) : null}
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
              <Th>Roles</Th>
              <Th>Since</Th>
              <Th right />
            </THead>
            <tbody>
              {S.staff.map((m) => {
                const me2 = m.id === S.viewer.id;
                const manage = canManage(m);
                return (
                  <TRow key={m.id}>
                    <Td className="font-semibold">
                      <span className={m.disabled ? "text-[#84908f] line-through" : ""}>{m.name}</span>
                      {m.owner ? (
                        <span className="ml-2 rounded-full bg-[#0d1d1d] px-2 py-0.5 text-[11px] font-semibold text-white">
                          Owner
                        </span>
                      ) : null}
                      {me2 ? <span className="ml-2 text-[12px] font-normal text-[#84908f]">you</span> : null}
                      {m.disabled ? (
                        <span className="ml-2 text-[12px] font-normal text-[#c7402f]">access removed</span>
                      ) : null}
                    </Td>
                    <Td className="text-[#465657]">{m.email}</Td>
                    <Td className="!whitespace-normal">
                      {m.owner ? <span className="text-[13px] text-[#465657]">Everything</span> : <RoleBadges g={m.grants} />}
                    </Td>
                    <Td>{fmtD(m.since)}</Td>
                    <Td right className="whitespace-nowrap">
                      {manage && !m.disabled ? (
                        <button
                          onClick={() => {
                            setEditing({ id: m.id, name: m.name, roles: asRoles(m.grants) });
                            setEditError("");
                          }}
                          disabled={S.saving}
                          className="mr-1.5 rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]"
                        >
                          Edit roles
                        </button>
                      ) : null}
                      {manage ? (
                        <button
                          onClick={() => toggleAccess(m.id, m.name, !m.disabled)}
                          disabled={S.saving}
                          className={`rounded-lg border bg-white px-3 py-1.5 text-[12.5px] font-semibold ${
                            m.disabled ? "border-[#d6dfde] text-[#055a5b]" : "border-[#f0cfc9] text-[#b3473a]"
                          }`}
                        >
                          {m.disabled ? "Restore access" : "Remove access"}
                        </button>
                      ) : null}
                      {manage && !m.disabled ? (
                        <div className="mt-1 flex justify-end gap-2.5">
                          <ResetLink userId={m.id} email={m.email} />
                          <SetPassword userId={m.id} email={m.email} />
                        </div>
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
            <div className="px-4 pb-4 text-[13px] text-[#84908f]">No open invites. Buyers are invited from the Customers page.</div>
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
                    <Td className="text-[#465657]">{i.role === "customer" ? customerName(i.customerId) : i.name}</Td>
                    <Td className="!whitespace-normal">
                      {i.grants ? <RoleBadges g={i.grants} /> : <Badge label="buyer portal" bg="#e8f1fb" fg="#3a8bd6" />}
                    </Td>
                    <Td>{fmtD(i.expires)}</Td>
                    <Td right>
                      {(i.grants ? mayGrant(me, i.grants) : S.canDo("eggsales")) ? (
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
        Each person can hold several roles: a level in any division (Layers admin and Feed mill staff, say), and
        cross-division roles — <strong>Sales</strong> (selling across every division; sees payments but doesn&apos;t
        record them), <strong>Accounts</strong> (money and every report), <strong>Store keeper</strong> (inventory at
        every location) and <strong>Reports viewer</strong>. They see the best their roles allow in each part of the
        farm. Only the <strong>owner</strong> gives admin roles; division admins manage their own staff. Removing
        access signs the person out straight away and keeps everything they recorded.
      </Note>
    </>
  );
}
