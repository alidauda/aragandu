"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { fmtD } from "@/lib/erp/derive";
import {
  areaOf,
  canSee,
  DIVISION_SCOPES,
  FUNCTION_HELP,
  FUNCTION_LABEL,
  FUNCTION_ROLES,
  mayGrant,
  noRoles,
  roleLabels,
  SCOPE_LABEL,
  SHARED_LABEL,
  sharedAreasOf,
  tidyDeny,
  type DivisionScope,
  type SharedArea,
  type FunctionRole,
  type Grants,
  type TeamLevel,
} from "@/lib/access";
import { Drawer, FormError, NewButton, TextField } from "@/components/erp/Drawer";
import { InviteLink } from "@/components/erp/InviteLink";
import { ALL_PAGES } from "@/components/erp/Sidebar";
import { ResetLink, SetPassword } from "@/components/erp/ResetLink";
import { Badge, Card, CardTitle, Note, PageHeader, Table, THead, TRow, Td, Th, usePaged } from "@/components/erp/ui";
import { confirmDialog } from "@/components/Dialogs";

type Roles = Omit<Grants, "owner">;
const EMPTY: Roles = { farm: null, divisions: {}, functions: [], deny: [] };
const asRoles = (g: Grants): Roles => ({
  farm: g.farm,
  divisions: { ...g.divisions },
  functions: [...g.functions],
  deny: [...(g.deny ?? [])],
});
const asGrantsOf = (r: Roles): Grants => ({ owner: false, ...r });

const LEVEL_HELP: Record<TeamLevel, string> = {
  staff: "records the day's work; can't correct or delete",
  admin: "also corrects and deletes records, records payments and manages its people",
};

/** What each division's team does, for the access form. */
const DIVISION_HELP: Record<DivisionScope, string> = {
  layers: "Eggs, flocks, feed, health, egg orders and sales",
  feed: "Ingredients, production runs, feed stock and feed sales",
  broilers: "Batches, daily records, weighing, processing and sales",
  brooding: "Chicks: daily records, weighing, dispatch and sales",
  ruminants: "Goats, sheep and cattle: animals, weights, health, feed and sales",
};

/**
 * The menu someone's roles give them, as the sidebar will show it: each part
 * of the farm with the pages they'll see in it. The shared pages (Inventory,
 * Customers…) sit between `top` and `tail`.
 */
function menuOf(g: Grants) {
  const see = (href: string) => canSee(g, areaOf(href));
  const row = (section: string) => {
    const all = ALL_PAGES.filter((p) => p.section === section);
    // As in the sidebar: without the mill, its requests come under "Feed requests".
    const mine = all.filter((p) => see(p.href) && !(p.href === "/feed/requests" && !canSee(g, "feed")));
    return { all, mine };
  };
  const top: { name: string; pages: string }[] = [];
  if (canSee(g, "dashboard")) top.push({ name: "Dashboard", pages: "the whole farm at a glance" });
  for (const section of [...new Set(ALL_PAGES.map((p) => p.section))]) {
    if (section === "Overview" || section === "Shared" || section === "Admin") continue;
    const { all, mine } = row(section);
    if (mine.length === 0) continue;
    top.push({
      name: section,
      pages: mine.length === all.length ? "every page" : `only ${mine.map((p) => p.label.replace(`${section} overview`, "Overview")).join(", ")}`,
    });
  }
  if (canSee(g, "requests") && !canSee(g, "feed")) top.push({ name: "Feed requests", pages: "asking the mill for feed" });
  const tail: { name: string; pages: string }[] = [];
  const admin = row("Admin").mine;
  if (admin.length) tail.push({ name: admin.map((p) => p.label).join(", "), pages: "" });
  return { top, tail };
}

/** With these choices, would they have any page to open at all? */
const seesNothing = (g: Grants) => {
  const { top, tail } = menuOf(g);
  return top.length + tail.length === 0 && sharedAreasOf(g).every((a) => (g.deny ?? []).includes(a));
};

/** Someone's menu in a line: "Sees everything except Inventory". */
function seesLine(g: Grants) {
  const hidden = (g.deny ?? []).map((a) => SHARED_LABEL[a]);
  if (g.farm) return `Sees everything${hidden.length ? ` except ${hidden.join(", ")}` : ""}`;
  const { top, tail } = menuOf(g);
  const shared = sharedAreasOf(g).filter((a) => !(g.deny ?? []).includes(a)).map((a) => SHARED_LABEL[a]);
  const names = [...top.map((r) => (r.pages.startsWith("only ") ? `${r.name} (${r.pages.slice(5)})` : r.name)), ...shared, ...tail.map((r) => r.name)];
  return names.length ? `Sees ${names.join(", ")}` : "Sees nothing yet";
}

/**
 * The access form, in plain words: tick their jobs, then check the list of
 * pages they'll see and untick any shared page they shouldn't have. Choices
 * the viewer can't give are left out.
 */
function RolesEditor({ value, onChange: save }: { value: Roles; onChange: (r: Roles) => void }) {
  // A hidden page is forgotten once their jobs stop opening it, so it can't surprise a later change.
  const onChange = (r: Roles) => save(tidyDeny(r));
  const S = useErp();
  const me = S.grants;
  // Could they give this set of roles? (The server checks the same.)
  const allowed = (r: Roles) => mayGrant(me, asGrantsOf(r));
  const withDivision = (d: DivisionScope, l: TeamLevel | null): Roles => {
    const divisions = { ...value.divisions };
    if (l) divisions[d] = l;
    else delete divisions[d];
    return { ...value, divisions };
  };
  const withFunction = (f: FunctionRole): Roles => ({
    ...value,
    functions: value.functions.includes(f) ? value.functions.filter((x) => x !== f) : [...value.functions, f],
  });

  // What these choices give: their menu, and the shared pages that can be kept from them.
  const g = asGrantsOf(value);
  const menu = menuOf(g);
  const shared = sharedAreasOf(g);
  const deny = value.deny ?? [];
  const toggleShared = (a: SharedArea) => onChange({ ...value, deny: deny.includes(a) ? deny.filter((x) => x !== a) : [...deny, a] });
  const inCharge = [
    ...(value.farm === "admin" ? ["the whole farm"] : []),
    ...DIVISION_SCOPES.filter((d) => value.divisions[d] === "admin").map((d) => SCOPE_LABEL[d].replace(" (chicken)", "")),
  ];

  const tile = (on: boolean) => `rounded-xl border px-3 py-2.5 ${on ? "border-[#055a5b] bg-[#f3f8f7]" : "border-[#e4eaea]"}`;
  const box = "mt-0.5 size-4 shrink-0 accent-[#055a5b]";
  // Staff or admin, once a division (or the whole farm) is ticked.
  const levels = (name: string, current: TeamLevel, can: (l: TeamLevel) => boolean, set: (l: TeamLevel) => void) => (
    <div className="ml-[26px] mt-2 flex flex-col gap-1.5">
      {(["staff", "admin"] as const).map((l) =>
        l === current || can(l) ? (
          <label key={l} className="flex cursor-pointer items-start gap-2 text-[12.5px] text-[#465657]">
            <input type="radio" name={`level-${name}`} checked={current === l} onChange={() => set(l)} className="mt-0.5 accent-[#055a5b]" />
            <span>
              <span className="font-semibold text-[#0d1d1d]">{l === "admin" ? "Admin" : "Staff"}</span> — {LEVEL_HELP[l]}
            </span>
          </label>
        ) : null
      )}
    </div>
  );
  const heading = "font-sub text-[15px] text-[#0d1d1d]";
  const hint = "text-[12.5px] text-[#5d6b6b]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className={heading}>1. What is their job?</div>
        <div className={`mb-2 ${hint}`}>Tick everything they do. They see only the pages for what you tick.</div>
        {value.farm || allowed({ ...value, farm: "admin" }) ? (
          <div className={`mb-2 ${tile(value.farm !== null)}`}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={value.farm !== null}
                onChange={() => onChange({ ...value, farm: value.farm ? null : "admin" })}
                className={box}
              />
              <span>
                <span className="block font-sub text-[14px] text-[#0d1d1d]">Farm manager</span>
                <span className={`block ${hint}`}>
                  Runs the whole farm: sees every page, and can correct, delete, record payments and manage people.
                </span>
              </span>
            </label>
          </div>
        ) : null}
        {value.farm ? (
          <div className={hint}>A farm manager needs no other job ticked. Untick it to choose particular jobs instead.</div>
        ) : (
          <>
        <div className="flex flex-col gap-2">
          {FUNCTION_ROLES.map((f) => {
            const on = value.functions.includes(f);
            if (!on && !allowed(withFunction(f))) return null;
            return (
              <div key={f} className={tile(on)}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={on} onChange={() => onChange(withFunction(f))} className={box} />
                  <span>
                    <span className="block font-sub text-[14px] text-[#0d1d1d]">{FUNCTION_LABEL[f]}</span>
                    <span className={`block ${hint}`}>{FUNCTION_HELP[f]}</span>
                  </span>
                </label>
              </div>
            );
          })}
        </div>
        <div className={`mb-2 mt-3 ${hint}`}>Or they work in a division:</div>
        <div className="grid grid-cols-2 gap-2">
          {DIVISION_SCOPES.map((d) => {
            const current = value.divisions[d] ?? null;
            if (!current && !allowed(withDivision(d, "staff"))) return null;
            return (
              <div key={d} className={`${tile(current !== null)} ${current ? "col-span-2" : ""}`} title={DIVISION_HELP[d]}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={current !== null}
                    onChange={() => onChange(withDivision(d, current ? null : "staff"))}
                    aria-label={`Works in ${SCOPE_LABEL[d].replace(" (chicken)", "")}`}
                    className={box}
                  />
                  <span>
                    <span className="block font-sub text-[14px] text-[#0d1d1d]">{SCOPE_LABEL[d].replace(" (chicken)", "")}</span>
                    {current ? <span className={`block ${hint}`}>{DIVISION_HELP[d]}</span> : null}
                  </span>
                </label>
                {current ? levels(d, current, (l) => allowed(withDivision(d, l)), (l) => onChange(withDivision(d, l))) : null}
              </div>
            );
          })}
        </div>
          </>
        )}
      </div>

      <div>
        <div className={heading}>2. What they will see</div>
        {menu.top.length + menu.tail.length + shared.length === 0 ? (
          <div className={`mt-1 ${hint}`}>Tick a job above and their pages show here.</div>
        ) : (
          <>
            <div className={`mb-2 ${hint}`}>This is their whole menu. Untick a page to hide it from them.</div>
            <div className="rounded-xl border border-[#e4eaea] px-3 py-1">
              {menu.top.map((r) => (
                <div key={r.name} className="flex items-start gap-2.5 border-b border-[#f0f3f3] py-2 text-[13.5px] last:border-0">
                  <span className="w-4 shrink-0 text-center font-bold text-[#016559]">✓</span>
                  <span>
                    <span className="font-semibold text-[#0d1d1d]">{r.name}</span>
                    {r.pages ? <span className="text-[#5d6b6b]"> — {r.pages}</span> : null}
                  </span>
                </div>
              ))}
              {shared.map((a) => {
                const on = !deny.includes(a);
                return (
                  <label key={a} className="flex cursor-pointer items-center gap-2.5 border-b border-[#f0f3f3] py-2 text-[13.5px] last:border-0">
                    <input type="checkbox" checked={on} onChange={() => toggleShared(a)} aria-label={`Can open ${SHARED_LABEL[a]}`} className="size-4 shrink-0 accent-[#055a5b]" />
                    <span className={on ? "font-semibold text-[#0d1d1d]" : "text-[#84908f] line-through"}>{SHARED_LABEL[a]}</span>
                    {on ? null : <span className="text-[12px] font-semibold text-[#c7402f]">hidden from them</span>}
                  </label>
                );
              })}
              {menu.tail.map((r) => (
                <div key={r.name} className="flex items-start gap-2.5 border-b border-[#f0f3f3] py-2 text-[13.5px] last:border-0">
                  <span className="w-4 shrink-0 text-center font-bold text-[#016559]">✓</span>
                  <span className="font-semibold text-[#0d1d1d]">{r.name}</span>
                </div>
              ))}
            </div>
            {inCharge.length ? (
              <div className={`mt-1.5 ${hint}`}>
                As admin of {inCharge.join(", ")}, they can also correct and delete records, record payments and manage
                its people.
              </div>
            ) : null}
          </>
        )}
      </div>

      {!S.viewer.owner ? (
        <div className="rounded-lg bg-[#f4f6f5] px-3 py-2 text-[12.5px] text-[#5d6b6b]">
          {S.farmWide
            ? "Only the owner can make someone an admin or a farm manager."
            : "You can add staff to the divisions you run. The owner gives admin and farm-wide access."}
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
        const hidden = l.startsWith("No ");
        return (
          <Badge
            key={l}
            label={l}
            bg={hidden ? "#ebf0ef" : admin ? "#fcf2de" : "#e2f0ed"}
            fg={hidden ? "#5d6b6b" : admin ? "#9a6a12" : "#016559"}
          />
        );
      })}
      <span className="basis-full text-[12px] text-[#84908f]">{seesLine(g)}</span>
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
    if (noRoles(asGrantsOf(roles))) return setError("Tick at least one job.");
    if (seesNothing(asGrantsOf(roles))) return setError("They wouldn't be able to open any page — tick a page under “What they will see”.");
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
      return setEditError("Tick at least one job — or remove their access instead.");
    }
    if (seesNothing(asGrantsOf(editing.roles))) {
      return setEditError("They wouldn't be able to open any page — tick a page under “What they will see”.");
    }
    setEditError("");
    const r = await S.setUserGrants({ userId: editing.id, roles: editing.roles });
    if (!r.ok) return setEditError(r.error);
    setEditing(null);
  };

  const toggleAccess = async (userId: string, name: string, disabled: boolean) => {
    const ok = await confirmDialog(
      disabled
        ? {
            title: `Remove ${name}'s access?`,
            body: "They're signed out at once and can't sign in. Their records stay.",
            confirmLabel: "Remove access",
            danger: true,
          }
        : { title: `Restore ${name}'s access?`, confirmLabel: "Restore access" }
    );
    if (ok) void S.setUserDisabled(userId, disabled);
  };

  const staffPage = usePaged(S.staff);
  const invitePage = usePaged(S.invites);
  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Team"
        sub="Who can use the ERP, and which pages each person sees"
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
        title={`Access — ${editing?.name ?? ""}`}
        sub="Changes apply straight away, on their next click."
        onSubmit={() => void saveRoles()}
        submitLabel="Save access"
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
          <Table pager={staffPage.pager}>
            <THead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Access</Th>
              <Th>Since</Th>
              <Th right />
            </THead>
            <tbody>
              {staffPage.rows.map((m) => {
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
                          Change access
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
            <Table pager={invitePage.pager}>
              <THead>
                <Th>Email</Th>
                <Th>For</Th>
                <Th>Access</Th>
                <Th>Expires</Th>
                <Th right />
              </THead>
              <tbody>
                {invitePage.rows.map((i) => (
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
        Each person sees only the pages for the jobs ticked for them — “Sees…” under their name lists them. To change
        it, press <strong>Change access</strong>, tick their jobs, and untick any page they shouldn&apos;t open.{" "}
        <strong>Farm manager</strong> is for whoever runs the whole farm: it opens everything. Only the{" "}
        <strong>owner</strong> makes someone an admin or a farm manager. Removing access signs the person out straight away and keeps everything they recorded.
      </Note>
    </>
  );
}
