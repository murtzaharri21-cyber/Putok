"use client";

import { useState } from "react";
import { ORDER_STATUSES, type OrderItem } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/status";

type Row = {
  id: number;
  code: string;
  customerName: string;
  phone: string;
  village: string;
  address: string;
  deliverySlot: string;
  notes: string | null;
  totalPkr: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export default function Ledger({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(code: string, status: string) {
    setBusy(code);
    const prev = rows;
    setRows((r) => r.map((o) => (o.code === code ? { ...o, status } : o)));
    try {
      const res = await fetch(`/api/orders/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(prev);
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rule-thick mt-16 pt-8 text-xl italic text-ink-soft">
        No orders yet. The dough can sleep a little longer.
      </p>
    );
  }

  return (
    <div className="rule-thick mt-16">
      {rows.map((o) => {
        const done = o.status === "delivered" || o.status === "cancelled";
        return (
          <article
            key={o.code}
            className={`rule grid gap-4 py-6 md:grid-cols-[7rem_1fr_1fr_10rem_11rem] ${done ? "opacity-50" : ""}`}
          >
            <div>
              <div className="mono">{o.code}</div>
              <div className="mono mt-1 text-ink-soft">
                {new Date(o.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div>
              <div className="display text-2xl">{o.customerName}</div>
              <div className="text-ink-soft">{o.phone}</div>
              <div className="mt-1 text-sm text-ink-soft">
                <strong className="text-ink">{o.village}</strong> · {o.address}
              </div>
              {o.notes && <div className="mt-1 text-sm italic text-ink-soft">“{o.notes}”</div>}
            </div>
            <ul className="text-lg">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity} × {it.productName}
                </li>
              ))}
            </ul>
            <div>
              <div className="mono text-ink-soft">{o.deliverySlot}</div>
              <div className="display text-2xl">{rs(o.totalPkr)}</div>
            </div>
            <label className="block">
              <span className="mono text-ink-soft">Status</span>
              <select
                className="field mt-0 py-2 text-base"
                value={o.status}
                disabled={busy === o.code}
                onChange={(e) => setStatus(o.code, e.target.value)}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </article>
        );
      })}
    </div>
  );
}
