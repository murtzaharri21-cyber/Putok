import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { getAllOrders } from "@/db/queries";
import Ledger from "./Ledger";
import PhotoUpload from "./PhotoUpload";

export const dynamic = "force-dynamic";

export default async function BakeryPage() {
  const orders = await getAllOrders();
  const [photo] = await db
    .select({ updatedAt: assets.updatedAt })
    .from(assets)
    .where(eq(assets.key, "putok-photo"));
  const today = new Date();
  const open = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const rounds = open.reduce(
    (s, o) => s + o.items.reduce((t, i) => t + i.quantity, 0),
    0,
  );

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="mono hover:text-apricot">
          ← Shop front
        </Link>
        <span className="mono">
          Ledger ·{" "}
          {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </header>

      <div className="mt-14 grid gap-8 md:grid-cols-12 md:items-end">
        <h1 className="display text-5xl md:col-span-7 md:text-7xl">
          Azra&apos;s <span className="italic-display text-ink-soft">Putok orders.</span>
        </h1>
        <dl className="grid grid-cols-3 gap-6 md:col-span-5">
          {[
            ["Open orders", open.length],
            ["Line items", rounds],
            ["All time", orders.length],
          ].map(([k, v]) => (
            <div key={k} className="rule pt-3">
              <dt className="mono text-ink-soft">{k}</dt>
              <dd className="display mt-1 text-4xl">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <PhotoUpload
        source={photo ? "upload" : "fallback"}
        version={photo ? photo.updatedAt.getTime() : 0}
      />

      <div className="mt-20">
        <div className="mono text-ink-soft">Orders</div>
      </div>
      <Ledger initial={orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() }))} />
    </main>
  );
}
