"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product } from "@/db/schema";
import { measureScene, scrollState } from "./scrollState";

const PutokScene = dynamic(() => import("./PutokScene"), { ssr: false });

const VILLAGES = [
  "Karimabad",
  "Aliabad",
  "Altit",
  "Ganish",
  "Hyderabad",
  "Murtazabad",
  "Hassanabad",
  "Dorkhan",
  "Gulmit",
  "Other",
];

const SLOTS = [
  { value: "07:00-08:00", label: "7 – 8 in the morning" },
  { value: "08:00-09:00", label: "8 – 9 in the morning" },
  { value: "09:00-10:00", label: "9 – 10, for late risers" },
];

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

function Stamp() {
  return (
    <div className="relative h-28 w-28 md:h-36 md:w-36">
      <svg viewBox="0 0 200 200" className="spin-slow absolute inset-0 h-full w-full">
        <defs>
          <path id="circ" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
        </defs>
        <text className="fill-ink" style={{ fontFamily: "var(--font-mono)", fontSize: 15, letterSpacing: 3 }}>
          <textPath href="#circ">BAKED BEFORE SUNRISE · KARIMABAD · HUNZA · 2,438 M ·</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="display text-4xl md:text-5xl">پ</span>
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    "Fresh every morning",
    "Delivered in central Hunza by 8 am",
    "Cash on delivery",
    "White flour · water · salt · fire",
    "Karimabad → Aliabad → Altit → Ganish",
    "Best torn, never sliced",
  ];
  const line = items.map((t, i) => (
    <span key={i} className="mono inline-flex items-center gap-6 px-6 text-paper">
      {t}
      <span className="text-apricot">✦</span>
    </span>
  ));
  return (
    <div className="marquee overflow-hidden bg-ink py-3">
      <div className="marquee-track">
        {line}
        {line}
      </div>
    </div>
  );
}

export default function Storefront({ products }: { products: Product[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    village: "Karimabad",
    address: "",
    deliverySlot: "07:00-08:00",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  /* Scroll -> 3D scene mapping, pointer parallax, reveal-on-scroll */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    let raf = 0;
    const update = () => {
      raf = 0;
      scrollState.scene = measureScene(sections);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onPointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const lines = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, qty: cart[p.id] })),
    [products, cart],
  );
  const total = lines.reduce((s, l) => s + l.qty * l.product.pricePkr, 0);
  const pieces = lines.reduce((s, l) => s + l.qty * l.product.pieces, 0);

  const openOrderForm = () => {
    setOrderOpen(true);
    window.setTimeout(() => {
      document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const setQty = (id: number, qty: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(50, qty)) }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lines.length === 0) {
      setError("Your basket is empty — pick something from the price list above.");
      document.getElementById("prices")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not place order");
      router.push(`/order/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order");
      setSubmitting(false);
    }
  }

  return (
    <>
      <PutokScene />

      {/* Top bar */}
      <header className="pointer-events-auto relative z-30 mx-auto flex max-w-[1400px] items-center justify-between px-6 pt-6 md:px-10">
        <div className="mono">Karimabad, Hunza · 36.32° N</div>
        <nav className="mono hidden gap-8 md:flex">
          <a href="#what" className="hover:text-apricot">What it is</a>
          <a href="#made" className="hover:text-apricot">How it&apos;s made</a>
          <a href="#prices" className="hover:text-apricot">Price list</a>
          <a href="#order" className="hover:text-apricot">Order</a>
          <Link href="/admin" className="hover:text-apricot">Admin</Link>
        </nav>
        <a href="#order" className="mono rounded-full border border-ink px-4 py-2 hover:bg-ink hover:text-paper">
          Basket · {pieces}
        </a>
      </header>

      {/* 0 — HERO */}
      <section data-scene className="pointer-events-auto relative z-30 mx-auto flex min-h-screen max-w-[1400px] flex-col justify-end px-6 pb-10 pt-8 md:px-10 md:pt-10">
        <div className="mb-6 flex items-end justify-between md:mb-10">
          <p className="mono max-w-xs leading-relaxed text-ink-soft">
            (n.) the round oven bread of Hunza.
            <br />
            eaten in the morning, with milk tea.
          </p>
          <div className="hidden md:block">
            <Stamp />
          </div>
        </div>
        <h1 className="display text-[22vw] leading-[0.82] md:text-[17vw]">
          PUT<span className="outline-text">O</span>K
        </h1>
        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-end">
          <p className="display text-3xl md:col-span-6 md:text-5xl">
            White flour, water, salt. <br />
            <span className="italic-display text-ink-soft">Fire does the rest.</span>
          </p>
          <div className="md:col-span-6 md:pl-10">
            <p className="max-w-md text-lg leading-relaxed text-ink-soft">
              We bake at five. The bread is at your door before the tea has finished boiling.
              Order tonight for tomorrow morning — anywhere between Hassanabad and Gulmit.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a href="#order" className="btn-ink rounded-full px-7 py-4 text-lg">
                Order for tomorrow →
              </a>
              <span className="mono text-ink-soft">↓ scroll to turn it over</span>
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      {/* 1 — WHAT IT IS */}
      <section id="what" data-scene className="pointer-events-auto relative z-30 mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-44">
        <div className="grid md:grid-cols-12">
          <div className="mono md:col-span-2">01 — What it is</div>
          <div className="md:col-span-6 md:col-start-7">
            <h2 className="display reveal text-5xl md:text-7xl">
              A round of bread the size of a <span className="scribble">dinner plate</span>, scored like the sun.
            </h2>
            <p className="reveal mt-10 max-w-xl text-xl leading-relaxed text-ink-soft">
              Putok is what most houses in Hunza wake up to. It isn&apos;t sweet, it isn&apos;t
              fancy, and it isn&apos;t meant to be eaten alone — it is meant to be torn into pieces and
              dipped into a cup of hot milk tea until it softens.
            </p>
            <p className="reveal mt-6 max-w-xl text-xl leading-relaxed text-ink-soft">
              The dough is plain white flour and water with a little salt. It rests, it gets shaped
              by hand into a thick disc, the top is cut in lines with a knife so it bakes evenly, and
              it goes into a hot oven until the crust turns the colour of dry apricots.
            </p>

            <dl className="reveal mt-14 grid grid-cols-2 gap-y-6 md:grid-cols-4">
              {[
                ["Diameter", "≈ 22 cm"],
                ["Weight", "≈ 450 g"],
                ["Ingredients", "4"],
                ["Keeps", "3 days"],
              ].map(([k, v]) => (
                <div key={k} className="rule pt-3">
                  <dt className="mono text-ink-soft">{k}</dt>
                  <dd className="display mt-1 text-3xl">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 2 — HOW IT'S MADE */}
      <section id="made" data-scene className="pointer-events-auto relative z-30 bg-paper-deep">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-44">
          <div className="grid md:grid-cols-12">
            <div className="mono md:col-span-2">02 — How it&apos;s made</div>
            <div className="md:col-span-5">
              <h2 className="display reveal text-5xl md:text-7xl">
                The oven is lit at <span className="italic-display">four-thirty.</span>
              </h2>
              <p className="reveal mt-8 max-w-lg text-xl leading-relaxed text-ink-soft">
                No mixers, no timers. The baker knows the dough is ready when it stops sticking to
                her palms, and the bread is done when the kitchen smells right.
              </p>
              <ol className="reveal mt-14">
                {[
                  ["04:30", "Knead", "Flour, water, salt and yesterday's starter, worked by hand for twenty minutes."],
                  ["05:10", "Rest", "Covered with a cloth near the stove. The dough doubles while the tea brews."],
                  ["05:40", "Shape & score", "Rounded, pressed flat with the heel of the hand, then cut in parallel lines and one ring."],
                  ["06:00", "Bake", "Into the oven on a hot stone. Twenty-five minutes. Turned once."],
                  ["06:30", "Out", "Wrapped in paper while still hot. On the motorbike by seven."],
                ].map(([time, title, body], i) => (
                  <li key={time} className="rule grid grid-cols-[4rem_1fr] gap-x-4 py-6">
                    <span className="mono pt-2">{time}</span>
                    <div>
                      <div className="display text-3xl">
                        <span className="mono mr-2 text-apricot">{String(i + 1).padStart(2, "0")}</span>
                        {title}
                      </div>
                      <p className="mt-2 max-w-md text-ink-soft">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 3 — HOW WE EAT IT */}
      <section id="eat" data-scene className="pointer-events-auto relative z-30 mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-44">
        <div className="grid md:grid-cols-12">
          <div className="mono md:col-span-2">03 — How we eat it</div>
          <div className="md:col-span-6 md:col-start-7">
            <h2 className="display reveal text-5xl md:text-7xl">
              Tear it. <span className="italic-display text-ink-soft">Don&apos;t slice it.</span>
            </h2>
            <div className="reveal mt-10 space-y-6 text-xl leading-relaxed text-ink-soft">
              <p>
                Pull off a piece with your fingers. The inside should be dense and a little chewy, the
                crust should crackle. Dunk it into milk tea — the salty kind if you&apos;re in a
                traditional house, the sweet kind if there are children around.
              </p>
              <p>
                In summer, spread it with apricot jam or fresh butter. In winter, with a spoon of
                walnut oil and a pinch of salt. On the second day, toast it on the stove. On the third
                day, break it into soup.
              </p>
            </div>
            <figure className="reveal mt-14">
              <img
                src="https://images.pexels.com/photos/28319618/pexels-photo-28319618.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
                alt="Karimabad, Hunza valley in summer"
                className="aspect-[16/10] w-full object-cover grayscale-[20%] sepia-[25%]"
                loading="lazy"
              />
              <figcaption className="mono mt-3 flex justify-between text-ink-soft">
                <span>Karimabad, from above Baltit</span>
                <span>Photo · Nauman Hunzai</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 4 — PRICE LIST */}
      <section id="prices" data-scene className="pointer-events-auto relative z-30 mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-44">
        <div className="grid md:grid-cols-12">
          <div className="mono md:col-span-2">04 — Price list</div>
          <div className="md:col-span-6">
            <h2 className="display reveal text-5xl md:text-7xl">
              Written on the wall, <span className="italic-display">same as at the shop.</span>
            </h2>
            <p className="reveal mt-6 max-w-lg text-lg text-ink-soft">
              Prices in Pakistani rupees. Delivery is free within central Hunza; for Gulmit and
              beyond we add a little for petrol and tell you first.
            </p>

            <div className="reveal rule-thick mt-14">
              {products.map((p, i) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className={`rule grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-3 py-6 md:grid-cols-[3rem_1fr_7rem_8rem_auto] ${
                      qty > 0 ? "bg-apricot/10" : ""
                    }`}
                  >
                    <span className="mono text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="flex items-center gap-3">
                        <img
                          src={`/api/products/${p.id}/photo`}
                          alt=""
                          onError={(event) => { event.currentTarget.style.display = "none"; }}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                        <div className="display text-3xl md:text-4xl">{p.name}</div>
                      </div>
                      <div className="mt-1 text-ink-soft">{p.tagline}</div>
                    </div>
                    <div className="mono hidden text-ink-soft md:block">
                      {p.pieces} {p.pieces === 1 ? "round" : "rounds"}
                    </div>
                    <div className="col-start-2 md:col-auto">
                      <div className="display text-2xl md:text-3xl">{rs(qty > 0 ? qty * p.pricePkr : p.pricePkr)}</div>
                      <div className="mono mt-1 text-ink-soft">
                        {qty > 0 ? `${qty} × ${rs(p.pricePkr)}` : `${rs(p.pricePkr)} each`}
                      </div>
                    </div>
                    <div className="col-start-3 row-start-1 flex items-center gap-2 md:col-auto md:row-auto">
                      <button
                        type="button"
                        aria-label={`Remove one ${p.name}`}
                        className="qty-btn"
                        onClick={() => setQty(p.id, qty - 1)}
                      >
                        −
                      </button>
                      <span className="display w-8 text-center text-2xl tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${p.name}`}
                        className="qty-btn"
                        onClick={() => setQty(p.id, qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4">
              <span className="mono text-ink-soft">
                {pieces} {pieces === 1 ? "round" : "rounds"} in the basket
              </span>
              <span className="display text-4xl">{rs(total)}</span>
            </div>
            <button
              type="button"
              onClick={openOrderForm}
              className="order-cta mt-8 rounded-full border border-apricot px-7 py-4 text-xl"
            >
              Place order →
            </button>
          </div>
        </div>
      </section>

      {/* 5 — ORDER */}
      <section id="order" data-scene className="pointer-events-auto relative z-30 bg-ink text-paper">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-44">
          <div className="grid md:grid-cols-12">
            <div className="mono text-paper/60 md:col-span-2">05 — Order</div>
            <div className="md:col-span-6 md:col-start-7">
              <h2 className="display reveal text-5xl md:text-7xl">
                Tomorrow morning, <span className="italic-display text-apricot">at your door.</span>
              </h2>
              <p className="reveal mt-6 text-lg text-paper/70">
                Orders placed before 10 pm are baked the next morning. Pay the rider in cash.
              </p>

              {!orderOpen && (
                <div className="reveal mt-12 border border-dashed border-paper/40 p-6 md:p-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="mono text-paper/60">Ready for tomorrow&apos;s breakfast?</p>
                      <p className="mt-3 text-xl text-paper/80">
                        Choose your bread above, then enter your delivery details here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOrderOpen(true)}
                      className="order-cta rounded-full border border-apricot px-7 py-4 text-xl"
                    >
                      Order now →
                    </button>
                  </div>
                </div>
              )}

              {orderOpen && <form id="order-form" onSubmit={submit} className="order-form reveal mt-12 space-y-8">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOrderOpen(false)}
                    className="order-close mono rounded-full border border-paper/50 px-4 py-2 text-paper hover:border-apricot hover:text-apricot"
                  >
                    Close form
                  </button>
                </div>
                <div className="grid gap-8 md:grid-cols-2">
                  <label className="block">
                    <span className="mono text-paper/60">Your name</span>
                    <input
                      className="field"
                      placeholder="e.g. Shamsher Ali"
                      required
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mono text-paper/60">Phone (we&apos;ll WhatsApp you)</span>
                    <input
                      className="field"
                      placeholder="03xx xxxxxxx"
                      required
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mono text-paper/60">Village</span>
                    <select
                      className="field"
                      value={form.village}
                      onChange={(e) => setForm({ ...form, village: e.target.value })}
                    >
                      {VILLAGES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mono text-paper/60">Delivery hour</span>
                    <select
                      className="field"
                      value={form.deliverySlot}
                      onChange={(e) => setForm({ ...form, deliverySlot: e.target.value })}
                    >
                      {SLOTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="mono text-paper/60">House / landmark</span>
                  <input
                    className="field"
                    placeholder="Near the polo ground, green gate, second house after the water channel"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mono text-paper/60">Anything else</span>
                  <input
                    className="field"
                    placeholder="Extra crusty, please / call before ringing / leave with the neighbour"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>

                {/* Receipt */}
                <div className="border border-dashed border-paper/40 p-6">
                  <div className="mono mb-4 flex justify-between text-paper/60">
                    <span>Your basket</span>
                    <span>Qty × price</span>
                  </div>
                  {lines.length === 0 ? (
                    <p className="italic text-paper/60">
                      Nothing yet.{" "}
                      <a href="#prices" className="underline decoration-apricot underline-offset-4">
                        Pick from the price list.
                      </a>
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {lines.map((l) => (
                        <li key={l.product.id} className="flex justify-between text-lg">
                          <span>{l.product.name}</span>
                          <span className="tabular-nums">
                            {l.qty} × {rs(l.product.pricePkr)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex items-baseline justify-between border-t border-paper/30 pt-4">
                    <span className="mono text-paper/60">Total, cash on delivery</span>
                    <span className="display text-3xl">{rs(total)}</span>
                  </div>
                </div>

                {error && <p className="text-apricot">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="order-submit w-full rounded-full border border-apricot px-7 py-5 text-xl md:w-auto"
                >
                  {submitting ? "Sending to the bakery…" : `Place order · ${rs(total)}`}
                </button>
              </form>}
            </div>
          </div>
        </div>
      </section>

      {/* 6 — FOOTER */}
      <footer data-scene className="pointer-events-auto relative z-30 mx-auto flex min-h-[80vh] max-w-[1400px] flex-col justify-between px-6 pb-8 pt-24 md:px-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="mono text-ink-soft">Bakery</div>
            <p className="mt-2 text-lg">
              Behind the old polo ground,
              <br />
              Karimabad, Hunza 15700
            </p>
          </div>
          <div className="md:col-span-4">
            <div className="mono text-ink-soft">Hours</div>
            <p className="mt-2 text-lg">
              Baking 04:30 – 07:00
              <br />
              Shop open 07:00 – 11:00, or until it&apos;s gone
            </p>
          </div>
          <div className="md:col-span-4">
            <div className="mono text-ink-soft">For the baker</div>
            <p className="mt-2 text-lg">
              <Link href="/bakery" className="underline decoration-apricot underline-offset-4">
                Open the order ledger →
              </Link>
              <br />
              <Link href="/bakery#photo" className="underline decoration-apricot underline-offset-4">
                Change the putok photo →
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-24">
          <div className="display text-[26vw] leading-[0.8] text-ink/90 md:text-[20vw]">PUTOK</div>
          <div className="mono mt-6 flex flex-wrap justify-between gap-4 text-ink-soft">
            <span>© {new Date().getFullYear()} · Made in Hunza</span>
            <span>Milk tea not included. Yet.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
