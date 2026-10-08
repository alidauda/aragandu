"use client";

import { useState } from "react";

import { useErp } from "@/lib/erp/store";
import { customerAggregates, fmtK, fmtN } from "@/lib/erp/derive";
import {
  Drawer,
  FieldRow,
  NewButton,
  TextField,
} from "@/components/erp/Drawer";
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
} from "@/components/erp/ui";

export default function Customers() {
  const S = useErp();
  const agg = customerAggregates(S.customers, S.invoices, S.orders, S.weekStart);
  const receivables = agg.reduce((a, c) => a + c.owed, 0);
  const onHold = agg.filter((c) => c.hold).length;
  const allocated = agg.reduce((a, c) => a + c.alloc, 0);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", alloc: "" });

  const [loginFor, setLoginFor] = useState<number | null>(null);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const loginCustomer = S.customers.find((c) => c.id === loginFor);

  const issueLogin = async () => {
    if (loginFor === null) return;
    setLoginError("");
    const r = await S.createBuyerLogin({
      customerId: loginFor,
      email: login.email.trim(),
      password: login.password,
    });
    if (!r.ok) {
      setLoginError(r.error);
      return;
    }
    setLogin({ email: "", password: "" });
    setLoginFor(null);
  };

  const save = () => {
    const alloc = parseInt(form.alloc, 10);
    if (!form.name.trim() || !alloc || alloc <= 0) return;
    S.addCustomer({ name: form.name.trim(), phone: form.phone.trim(), alloc });
    setForm({ name: "", phone: "", alloc: "" });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise"
        title="Customers"
        sub="Every buyer is one record — debt, history and portal access"
        action={<NewButton onClick={() => setOpen(true)}>New buyer</NewButton>}
      />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New buyer"
        sub="One record for debt, history and the portal login"
        onSubmit={save}
        submitLabel="Add buyer"
      >
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
      </Drawer>

      <Drawer
        open={loginFor !== null}
        onClose={() => {
          setLoginFor(null);
          setLoginError("");
        }}
        title="Portal login"
        sub={`Lets ${loginCustomer?.name ?? "this buyer"} order online. Share the password with them directly.`}
        onSubmit={() => void issueLogin()}
        submitLabel="Create login"
      >
        <TextField
          label="Email"
          type="email"
          value={login.email}
          onChange={(v) => setLogin({ ...login, email: v })}
          placeholder="orders@business.com"
        />
        <TextField
          label="Password (8+ characters)"
          type="password"
          value={login.password}
          onChange={(v) => setLogin({ ...login, password: v })}
        />
        {loginError ? (
          <div className="text-[12.5px] text-[#b3402f]">{loginError}</div>
        ) : null}
      </Drawer>

      <div className="stagger grid grid-cols-4 gap-3.5">
        <Kpi
          label="Customers"
          value={String(agg.length)}
          sub="portal + walk-in buyers"
        />
        <Kpi
          label="Receivables"
          value={fmtN(receivables)}
          sub="all pending invoices"
          color="#a06a0e"
        />
        <Kpi
          label="On debt hold"
          value={String(onHold)}
          sub="unpaid pre-week invoices"
          color="#b3402f"
        />
        <Kpi
          label="Weekly crates allocated"
          value={fmtK(allocated)}
          sub="across portal customers"
          color="#2f7cb6"
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
                ? { bg: "#fbe9e5", fg: "#b3402f" }
                : { bg: "#e8f2e5", fg: "#3f6f3a" };
              return (
                <TRow key={c.id}>
                  <Td className="font-semibold">{c.name}</Td>
                  <Td className="text-[#59614a]">{c.phone}</Td>
                  <Td right>{c.alloc}</Td>
                  <Td right>{c.used}</Td>
                  <Td
                    right
                    className="font-semibold"
                  >
                    <span style={{ color: c.owed ? "#a06a0e" : "#8a9070" }}>
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
                  <Td className="text-[#59614a]">
                    {c.logins.length ? (
                      c.logins.join(", ")
                    ) : (
                      <button
                        onClick={() => setLoginFor(c.id)}
                        className="rounded-lg border border-[#cfd3bd] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#3c4d28]"
                      >
                        Issue login
                      </button>
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
