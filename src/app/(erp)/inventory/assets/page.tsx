"use client";

import { useMemo, useState } from "react";

import { downloadCsv } from "@/lib/csv";
import { fmtD, fmtK } from "@/lib/erp/derive";
import { useErp } from "@/lib/erp/store";
import type { Asset } from "@/lib/erp/types";
import {
  ASSET_CONDITIONS,
  asCondition,
  CONDITION_LABEL,
  CONDITION_TONE,
  joinTag,
  nextNumber,
  splitTag,
  type AssetCondition,
} from "@/lib/erp/assets";
import { InventoryTabs } from "@/components/erp/InventoryTabs";
import { Drawer, FieldRow, FormError, NewButton, SelectField, TextField } from "@/components/erp/Drawer";
import { Badge, Card, Kpi, Note, PageHeader, Table, Td, Th, THead, TRow } from "@/components/erp/ui";

const DEFAULT_PREFIX = "AF/AD/OFE";
const conditionOptions = ASSET_CONDITIONS.map((c) => ({ label: CONDITION_LABEL[c], value: c }));
const small = "rounded-lg border border-[#d6dfde] bg-white px-2.5 py-1.5 text-[13px]";

/**
 * The asset register: every tagged item (furniture, computers, fans,
 * freezers…) with where it is and its condition — the farm's paper
 * register, kept current, with each item's history.
 */
export default function AssetRegister() {
  const S = useErp();
  const admin = S.canDo("inventory", "admin");
  const live = S.assets.filter((a) => !a.disposedAt);
  const locations = useMemo(() => [...new Set(S.assets.map((a) => a.location))].sort(), [S.assets]);
  const names = useMemo(() => [...new Set(S.assets.map((a) => a.name))].sort(), [S.assets]);
  const prefixes = useMemo(() => [...new Set(S.assets.map((a) => splitTag(a.tag).prefix))].sort(), [S.assets]);

  // ── Filters
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [cond, setCond] = useState("");
  const [item, setItem] = useState("");
  const [showGone, setShowGone] = useState(false);
  const shown = (showGone ? S.assets : live).filter(
    (a) =>
      (!loc || a.location === loc) &&
      (!cond || a.condition === cond) &&
      (!item || a.name === item) &&
      (!q.trim() || `${a.tag} ${a.name} ${a.location} ${a.assignedTo}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  // ── Selection: move or set the condition of several at once
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState({ location: "", condition: "" });
  const [bulkError, setBulkError] = useState("");
  const visiblePicked = shown.filter((a) => picked.has(a.id) && !a.disposedAt);
  const toggle = (id: number) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const applyBulk = async () => {
    if (!bulk.location.trim() && !bulk.condition) return setBulkError("Choose where they go or their condition.");
    setBulkError("");
    const r = await S.updateAssets({
      ids: visiblePicked.map((a) => a.id),
      location: bulk.location.trim() || undefined,
      condition: (bulk.condition || undefined) as AssetCondition | undefined,
    });
    if (!r.ok) return setBulkError(r.error);
    setPicked(new Set());
    setBulk({ location: "", condition: "" });
  };

  // ── Add one or a run
  const blankAdd = { name: "", prefix: prefixes[0] ?? DEFAULT_PREFIX, start: "", quantity: "1", location: "", condition: "good", assignedTo: "", notes: "" };
  const [addOpen, setAddOpen] = useState(false);
  const [add, setAdd] = useState(blankAdd);
  const [addError, setAddError] = useState("");
  const suggested = nextNumber(S.assets, add.name, add.prefix || DEFAULT_PREFIX);
  const start = add.start.trim() ? Number(add.start) : suggested;
  const qty = Number(add.quantity) || 0;
  const saveAdd = async () => {
    if (!add.name.trim()) return setAddError("Enter the item, e.g. Office Chair.");
    if (!add.prefix.trim()) return setAddError("Enter the tag's prefix, e.g. AF/AD/OFE.");
    if (!Number.isInteger(start) || start <= 0) return setAddError("The first number is a whole number.");
    if (!Number.isInteger(qty) || qty <= 0 || qty > 500) return setAddError("How many, from 1 to 500.");
    if (!add.location.trim()) return setAddError("Enter where it is, e.g. Board Room.");
    setAddError("");
    const r = await S.addAssets({
      name: add.name.trim(),
      prefix: add.prefix.trim(),
      start,
      quantity: qty,
      location: add.location.trim(),
      condition: add.condition as AssetCondition,
      assignedTo: add.assignedTo.trim(),
      notes: add.notes.trim(),
    });
    if (!r.ok) return setAddError(r.error);
    setAddOpen(false);
  };

  // ── One asset: details, history, write-off
  const [viewId, setViewId] = useState<number | null>(null);
  const viewing = S.assets.find((a) => a.id === viewId);
  const [edit, setEdit] = useState({ tag: "", name: "", location: "", condition: "good", assignedTo: "", notes: "" });
  const [editError, setEditError] = useState("");
  const openView = (a: Asset) => {
    setEdit({ tag: a.tag, name: a.name, location: a.location, condition: a.condition, assignedTo: a.assignedTo, notes: a.notes });
    setEditError("");
    setViewId(a.id);
  };
  const saveEdit = async () => {
    if (!viewing) return;
    if (viewing.disposedAt) return setViewId(null);
    if (!edit.tag.trim() || !edit.name.trim() || !edit.location.trim()) return setEditError("Tag, item and location are needed.");
    setEditError("");
    const r = await S.updateAsset({
      id: viewing.id,
      tag: edit.tag.trim(),
      name: edit.name.trim(),
      location: edit.location.trim(),
      condition: edit.condition as AssetCondition,
      assignedTo: edit.assignedTo.trim(),
      notes: edit.notes.trim(),
    });
    if (!r.ok) return setEditError(r.error);
    setViewId(null);
  };

  // ── Import from a spreadsheet
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const parsed = useMemo(() => parseRegister(importText), [importText]);
  const runImport = async () => {
    if (parsed.rows.length === 0) return setImportMsg("Paste the register or choose a CSV file first.");
    const r = await S.importAssets({ rows: parsed.rows });
    if (!r.ok) return setImportMsg(r.error);
    setImportMsg(
      `Added ${r.data.added} asset${r.data.added === 1 ? "" : "s"}.${
        r.data.skipped.length ? ` ${r.data.skipped.length} were already on the register (${r.data.skipped.slice(0, 3).join(", ")}${r.data.skipped.length > 3 ? "…" : ""}).` : ""
      }`
    );
    setImportText("");
  };

  const exportCsv = () =>
    downloadCsv(
      `argandu-asset-register-${S.today}.csv`,
      shown.map((a, i) => ({
        s_n: i + 1,
        item: a.name,
        item_number: a.tag,
        location: a.location,
        condition: CONDITION_LABEL[a.condition].toUpperCase(),
        assigned_to: a.assignedTo,
        notes: a.notes,
        written_off: a.disposedAt ? fmtD(a.disposedAt.slice(0, 10)) : "",
      }))
    );
  const printQuery = new URLSearchParams({ ...(loc ? { location: loc } : {}), ...(cond ? { condition: cond } : {}), ...(item ? { item } : {}) });

  const attention = live.filter((a) => a.condition === "repair" || a.condition === "damaged").length;

  return (
    <>
      <PageHeader
        eyebrow="Across the farm"
        title="Inventory"
        sub="The asset register — every tagged item, where it is and its condition"
        action={
          <>
            <a
              href={`/assets/register${printQuery.size ? `?${printQuery}` : ""}`}
              target="_blank"
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
            >
              Print register
            </a>
            <button
              type="button"
              onClick={() => {
                setImportMsg("");
                setImportOpen(true);
              }}
              className="rounded-[10px] border border-[#d6dfde] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#055a5b]"
            >
              Import
            </button>
            <NewButton
              onClick={() => {
                setAdd(blankAdd);
                setAddError("");
                setAddOpen(true);
              }}
            >
              Add assets
            </NewButton>
          </>
        }
      />
      <InventoryTabs />

      <div className="stagger mb-4 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Assets" value={fmtK(live.length)} sub={`${names.length} kinds of item`} />
        <Kpi label="Locations" value={String(new Set(live.map((a) => a.location)).size)} sub="rooms and offices" color="#3a8bd6" />
        <Kpi label="In good order" value={fmtK(live.filter((a) => a.condition === "good" || a.condition === "fair").length)} color="#016559" />
        <Kpi
          label="Need attention"
          value={String(attention)}
          sub={`${live.filter((a) => a.condition === "lost").length} lost`}
          color={attention ? "#c7402f" : "#0d1d1d"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, item, location…" className={`${small} min-w-[180px] flex-1`} />
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className={small} aria-label="Location">
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <select value={item} onChange={(e) => setItem(e.target.value)} className={small} aria-label="Item">
            <option value="">All items</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select value={cond} onChange={(e) => setCond(e.target.value)} className={small} aria-label="Condition">
            <option value="">Any condition</option>
            {conditionOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-[#465657]">
            <input type="checkbox" checked={showGone} onChange={(e) => setShowGone(e.target.checked)} className="accent-[#055a5b]" />
            Written off
          </label>
          <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="text-[13px] font-semibold text-[#055a5b] underline disabled:opacity-40">
            Download CSV
          </button>
        </div>

        {visiblePicked.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#ebf0ef] bg-[#f3f8f7] px-4 py-2.5">
            <span className="text-[13.5px] font-semibold text-[#0d1d1d]">{visiblePicked.length} selected</span>
            <input
              list="asset-locations"
              value={bulk.location}
              onChange={(e) => setBulk({ ...bulk, location: e.target.value })}
              placeholder="Move to…"
              className={small}
            />
            <select value={bulk.condition} onChange={(e) => setBulk({ ...bulk, condition: e.target.value })} className={small}>
              <option value="">Condition…</option>
              {conditionOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void applyBulk()}
              disabled={S.saving}
              className="rounded-lg bg-[#055a5b] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Apply
            </button>
            <button type="button" onClick={() => setPicked(new Set())} className="text-[13px] font-semibold text-[#5d6b6b]">
              Clear
            </button>
            {bulkError ? <span className="text-[13px] text-[#c7402f]">{bulkError}</span> : null}
          </div>
        ) : null}

        <Table>
          <THead>
            <Th>Item number</Th>
            <Th>Item</Th>
            <Th>Location</Th>
            <Th>Condition</Th>
            <Th>Assigned to</Th>
            <Th right />
          </THead>
          <tbody>
            {shown.length === 0 ? (
              <TRow>
                <Td colSpan={6} className="text-[#84908f]">
                  {S.assets.length ? "Nothing matches the filters." : "No assets yet — add them, or import your register."}
                </Td>
              </TRow>
            ) : null}
            {shown.map((a) => (
              <TRow key={a.id}>
                <Td>
                  <label className="flex items-center gap-2.5">
                    {!a.disposedAt ? (
                      <input
                        type="checkbox"
                        checked={picked.has(a.id)}
                        onChange={() => toggle(a.id)}
                        className="accent-[#055a5b]"
                        aria-label={`Select ${a.tag}`}
                      />
                    ) : null}
                    <span className={`font-figure font-semibold ${a.disposedAt ? "text-[#84908f] line-through" : ""}`}>{a.tag}</span>
                  </label>
                </Td>
                <Td className="font-semibold">{a.name}</Td>
                <Td className="text-[#465657]">{a.location}</Td>
                <Td>
                  {a.disposedAt ? (
                    <Badge label="written off" bg="#ebf0ef" fg="#5d6b6b" />
                  ) : (
                    <Badge label={CONDITION_LABEL[a.condition]} bg={CONDITION_TONE[a.condition].bg} fg={CONDITION_TONE[a.condition].fg} />
                  )}
                </Td>
                <Td className="text-[#465657]">{a.assignedTo || "—"}</Td>
                <Td right>
                  <button
                    type="button"
                    onClick={() => openView(a)}
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
      <datalist id="asset-locations">
        {locations.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <datalist id="asset-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="asset-prefixes">
        {[...new Set([...prefixes, DEFAULT_PREFIX])].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <Note>
        Each item carries its tag (AF/AD/OFE/121). Moving it or changing its condition is kept in its history (View).
        Something sold, scrapped or gone for good is <span className="font-semibold">written off</span> — off the register
        but kept on record. Tick several to move them or set their condition together.
      </Note>

      {/* Add */}
      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add assets"
        sub="One item, or a run of the same item with consecutive tags"
        onSubmit={() => void saveAdd()}
        submitLabel={qty > 1 ? `Add ${qty} assets` : "Add asset"}
      >
        <TextField label="Item" value={add.name} onChange={(v) => setAdd({ ...add, name: v, start: "" })} placeholder="Office Chair" list="asset-names" />
        <FieldRow>
          <TextField label="Tag prefix" value={add.prefix} onChange={(v) => setAdd({ ...add, prefix: v, start: "" })} list="asset-prefixes" />
          <TextField label="How many" type="number" value={add.quantity} onChange={(v) => setAdd({ ...add, quantity: v })} />
        </FieldRow>
        <TextField
          label={`First number (suggested ${suggested})`}
          type="number"
          value={add.start}
          onChange={(v) => setAdd({ ...add, start: v })}
          placeholder={String(suggested)}
        />
        {add.prefix.trim() && Number.isInteger(start) && start > 0 && qty > 0 ? (
          <div className="-mt-1 rounded-[10px] bg-[#f4f6f5] px-3 py-2 text-[13px] text-[#465657]">
            Tags <span className="font-figure font-semibold text-[#0d1d1d]">{joinTag(add.prefix, start)}</span>
            {qty > 1 ? (
              <>
                {" "}to <span className="font-figure font-semibold text-[#0d1d1d]">{joinTag(add.prefix, start + qty - 1)}</span>
              </>
            ) : null}
          </div>
        ) : null}
        <FieldRow>
          <TextField label="Location" value={add.location} onChange={(v) => setAdd({ ...add, location: v })} placeholder="Board Room" list="asset-locations" />
          <SelectField label="Condition" value={add.condition} onChange={(v) => setAdd({ ...add, condition: v })} options={conditionOptions} />
        </FieldRow>
        <TextField label="Assigned to (optional)" value={add.assignedTo} onChange={(v) => setAdd({ ...add, assignedTo: v })} placeholder="Jibrin" />
        <FormError message={addError} />
      </Drawer>

      {/* One asset */}
      <Drawer
        open={viewing !== undefined}
        onClose={() => setViewId(null)}
        title={viewing ? `${viewing.name} · ${viewing.tag}` : ""}
        sub={viewing?.disposedAt ? `Written off ${fmtD(viewing.disposedAt.slice(0, 10))}${viewing.disposedNote ? ` — ${viewing.disposedNote}` : ""}` : "Correct its details, move it or change its condition"}
        onSubmit={() => void saveEdit()}
        submitLabel={viewing?.disposedAt ? "Done" : "Save"}
      >
        {viewing ? (
          <>
            {!viewing.disposedAt ? (
              <>
                <FieldRow>
                  <TextField label="Item number (tag)" value={edit.tag} onChange={(v) => setEdit({ ...edit, tag: v })} />
                  <TextField label="Item" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} list="asset-names" />
                </FieldRow>
                <FieldRow>
                  <TextField label="Location" value={edit.location} onChange={(v) => setEdit({ ...edit, location: v })} list="asset-locations" />
                  <SelectField label="Condition" value={edit.condition} onChange={(v) => setEdit({ ...edit, condition: v })} options={conditionOptions} />
                </FieldRow>
                <TextField label="Assigned to (optional)" value={edit.assignedTo} onChange={(v) => setEdit({ ...edit, assignedTo: v })} />
                <TextField label="Notes (optional)" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} placeholder="Serial number, supplier…" />
              </>
            ) : null}
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-[#465657]">History</div>
              {viewing.history.length === 0 ? (
                <div className="text-[13px] text-[#84908f]">Nothing recorded yet.</div>
              ) : (
                viewing.history.map((h, i) => (
                  <div key={i} className="border-t border-[#ebf0ef] py-1.5 text-[13px]">
                    <div className="text-[#0d1d1d]">{h.summary}</div>
                    <div className="text-[12px] text-[#84908f]">
                      {new Date(h.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {h.by}
                    </div>
                  </div>
                ))
              )}
            </div>
            {admin ? (
              <div className="flex flex-wrap gap-2">
                {viewing.disposedAt ? (
                  <button type="button" onClick={() => void S.restoreAsset(viewing.id)} disabled={S.saving} className="rounded-lg border border-[#d6dfde] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#055a5b]">
                    Put back on the register
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={S.saving}
                    onClick={() => {
                      const reason = window.prompt(`Write off ${viewing.tag}? Say why (sold, scrapped, stolen…).`);
                      if (reason && reason.trim()) void S.disposeAsset(viewing.id, reason.trim()).then((r) => r.ok && setViewId(null));
                    }}
                    className="rounded-lg border border-[#f0cfc9] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#b3473a]"
                  >
                    Write off…
                  </button>
                )}
                <button
                  type="button"
                  disabled={S.saving}
                  onClick={() => {
                    if (window.confirm(`Delete ${viewing.tag} completely? Only for one added by mistake — write off anything that really left.`)) {
                      void S.deleteAsset(viewing.id).then((r) => r.ok && setViewId(null));
                    }
                  }}
                  className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[#b3473a] opacity-70 hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ) : null}
            <FormError message={editError} />
          </>
        ) : null}
      </Drawer>

      {/* Import */}
      <Drawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import the register"
        sub="Paste rows from Excel or Google Sheets, or choose a CSV file. Columns: S/N, Item, Item number, Location, Condition — the order of the paper register — or any order with a header row."
        onSubmit={() => void runImport()}
        submitLabel={parsed.rows.length ? `Import ${parsed.rows.length} asset${parsed.rows.length === 1 ? "" : "s"}` : "Import"}
      >
        <label className="block cursor-pointer rounded-xl border border-dashed border-[#c5dcd9] px-3 py-3 text-center text-[13.5px] font-semibold text-[#055a5b] hover:bg-[#f3f8f7]">
          Choose a CSV file
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImportText(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={8}
          placeholder={"S/N\tITEM\tITEM NUMBER\tLOCATION\tCONDITION\n1\tConference table\tAF/AD/OFE/1\tBoard Room\tGOOD"}
          className="w-full rounded-[10px] border border-[#d6dfde] bg-white px-3 py-2.5 font-mono text-[12.5px]"
        />
        {importText.trim() ? (
          <div className="rounded-[10px] bg-[#f4f6f5] px-3 py-2.5 text-[13px] text-[#465657]">
            <div className="font-semibold text-[#0d1d1d]">
              {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} ready
              {parsed.issues.length ? ` · ${parsed.issues.length} skipped` : ""}
            </div>
            {parsed.rows.slice(0, 4).map((r) => (
              <div key={r.tag} className="truncate">
                {r.tag} · {r.name} · {r.location} · {CONDITION_LABEL[r.condition]}
              </div>
            ))}
            {parsed.rows.length > 4 ? <div>…and {parsed.rows.length - 4} more</div> : null}
            {parsed.issues.slice(0, 3).map((m) => (
              <div key={m} className="text-[#c7402f]">
                {m}
              </div>
            ))}
          </div>
        ) : null}
        {importMsg ? <p className="text-[13.5px] font-semibold text-[#016559]">{importMsg}</p> : null}
      </Drawer>
    </>
  );
}

/** Reads a pasted or CSV register: tab-, comma- or semicolon-separated, with or without a header. */
function parseRegister(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: { tag: string; name: string; location: string; condition: AssetCondition }[] = [];
  const issues: string[] = [];
  if (lines.length === 0) return { rows, issues };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const cells = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === sep && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  // Columns from a header row, else the paper register's order.
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const find = (re: RegExp) => head.findIndex((h) => re.test(h));
  const hasHeader = head.some((h) => /item|location|condition|tag/.test(h));
  let col = { tag: 2, name: 1, location: 3, condition: 4 };
  if (hasHeader) {
    const tag = find(/item\s*(no|number|#)|tag|asset\s*(no|number|#)|code/);
    const name = head.findIndex((h, i) => i !== tag && /item|name|description/.test(h));
    col = { tag, name, location: find(/location|place|office|room/), condition: find(/condition|state|status/) };
  } else if (cells(lines[0]).length === 4) {
    col = { tag: 1, name: 0, location: 2, condition: 3 };
  }
  for (const [i, line] of (hasHeader ? lines.slice(1) : lines).entries()) {
    const c = cells(line);
    const tag = c[col.tag] ?? "";
    const name = c[col.name] ?? "";
    const location = c[col.location] ?? "";
    const rawCondition = col.condition >= 0 ? (c[col.condition] ?? "") : "";
    const condition = rawCondition ? asCondition(rawCondition) : "good";
    if (!tag && !name) continue;
    if (!tag || !name || !location) {
      issues.push(`Row ${i + 1}: needs an item, an item number and a location.`);
      continue;
    }
    if (!condition) {
      issues.push(`Row ${i + 1}: "${rawCondition}" isn't a condition (Good, Fair, Needs repair, Damaged, Lost).`);
      continue;
    }
    rows.push({ tag, name, location, condition });
  }
  return { rows, issues };
}
