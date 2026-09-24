import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode } from "@/db/queries";
import { STATUS_LABELS } from "@/lib/status";

export const dynamic = "force-dynamic";

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await getOrderByCode(code.toUpperCase());
  if (!result) notFound();
  const { order, items } = result;

  const placed = new Date(order.createdAt);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="mono hover:text-apricot">
          ← Back to the bread
        </Link>
        <span className="mono">Receipt</span>
      </header>

      <div className="mt-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="mono text-ink-soft">Order {order.code}</p>
          <h1 className="display mt-4 text-5xl md:text-7xl">
            Noted. <span className="italic-display text-ink-soft">It goes in the oven at six.</span>
          </h1>
          <p className="mt-8 max-w-md text-xl leading-relaxed text-ink-soft">
            Thank you, {order.customerName.split(" ")[0]}. The rider will be in {order.village}{" "}
            between {order.deliverySlot.replace("-", " and ")}. Have {rs(order.totalPkr)} ready in
            cash, and the kettle on.
          </p>
          <p className="mt-6 max-w-md text-ink-soft">
            Keep this page — the code above is what we&apos;ll ask for if you call about your order.
          </p>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="border border-dashed border-ink/50 p-6 md:p-8">
            <div className="display text-3xl">PUTOK</div>
            <div className="mono mt-1 text-ink-soft">Karimabad · Hunza</div>

            <dl className="mono mt-8 grid grid-cols-2 gap-y-2 text-ink-soft">
              <dt>Placed</dt>
              <dd className="text-right text-ink">
                {placed.toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
              <dt>Status</dt>
              <dd className="text-right text-ink">{STATUS_LABELS[order.status] ?? order.status}</dd>
              <dt>Deliver to</dt>
              <dd className="text-right text-ink">{order.village}</dd>
              <dt>Hour</dt>
              <dd className="text-right text-ink">{order.deliverySlot}</dd>
            </dl>

            <div className="rule mt-8 pt-4">
              <ul className="space-y-3">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between text-lg">
                    <span>
                      {it.quantity} × {it.productName}
                    </span>
                    <span className="tabular-nums">{rs(it.quantity * it.unitPricePkr)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rule-thick mt-6 flex items-baseline justify-between pt-4">
              <span className="mono">Total · cash</span>
              <span className="display text-4xl">{rs(order.totalPkr)}</span>
            </div>
            <p className="mt-6 text-sm text-ink-soft">{order.address}</p>
            {order.notes && <p className="mt-2 text-sm italic text-ink-soft">“{order.notes}”</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
