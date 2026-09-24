import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, type Product } from "@/db/schema";

const CATALOGUE = [
  {
    slug: "single",
    name: "One Putok",
    tagline: "A single round. Enough for one person and one pot of tea.",
    pieces: 1,
    pricePkr: 150,
    sortOrder: 1,
  },
  {
    slug: "morning-three",
    name: "Morning Three",
    tagline: "Three rounds, wrapped in paper. The usual household order.",
    pieces: 3,
    pricePkr: 420,
    sortOrder: 2,
  },
  {
    slug: "family-six",
    name: "Family Six",
    tagline: "Six rounds. Guests, cousins, or a long winter breakfast.",
    pieces: 6,
    pricePkr: 800,
    sortOrder: 3,
  },
  {
    slug: "putok-apricot",
    name: "Putok + Apricot Jam",
    tagline: "Two rounds and a 250g jar of Hunza apricot jam.",
    pieces: 2,
    pricePkr: 650,
    sortOrder: 4,
  },
  {
    slug: "week",
    name: "The Week",
    tagline: "One fresh putok at your door, seven mornings in a row.",
    pieces: 7,
    pricePkr: 950,
    sortOrder: 5,
  },
];

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    await db.insert(products).values(CATALOGUE).onConflictDoNothing();
  }
  seeded = true;
}

export async function getProducts(): Promise<Product[]> {
  try {
    await ensureSeeded();
    return db
      .select()
      .from(products)
      .where(eq(products.available, true))
      .orderBy(asc(products.sortOrder));
  } catch {
    return CATALOGUE.map((product, index) => ({
      ...product,
      id: index + 1,
      available: true,
    }));
  }
}

export async function getOrderByCode(code: string) {
  const [order] = await db.select().from(orders).where(eq(orders.code, code));
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return { order, items };
}

export async function getAllOrders() {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const items = await db.select().from(orderItems);
  return rows.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id),
  }));
}
