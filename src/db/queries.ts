import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  type Order,
  type OrderItem,
  type Product,
} from "@/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

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

export type OrderWithItems = Order & { items: OrderItem[] };

export async function ensureSeeded() {
  if (seeded) return;
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    await db.insert(products).values(CATALOGUE).onConflictDoNothing();
  }
  seeded = true;
}

export async function getProducts(): Promise<Product[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id,slug,name,tagline,pieces,price_pkr,available,sort_order")
      .eq("available", true)
      .order("sort_order");
    if (error) throw new Error(`Supabase product query failed: ${error.message}`);
    return (data ?? []).map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      pieces: product.pieces,
      pricePkr: product.price_pkr,
      available: product.available,
      sortOrder: product.sort_order,
    }));
  }

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
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("code", code)
      .maybeSingle();

    if (error) throw new Error(`Supabase order query failed: ${error.message}`);
    if (!data) return null;

    const order: Order = {
      id: data.id,
      code: data.code,
      customerName: data.customer_name,
      phone: data.phone,
      village: data.village,
      address: data.address,
      deliverySlot: data.delivery_slot,
      notes: data.notes,
      totalPkr: data.total_pkr,
      status: data.status,
      createdAt: new Date(data.created_at),
    };
    const items: OrderItem[] = (data.order_items ?? []).map((item: {
      id: number;
      order_id: number;
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price_pkr: number;
    }) => ({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPricePkr: item.unit_price_pkr,
    }));

    return { order, items };
  }

  const [order] = await db.select().from(orders).where(eq(orders.code, code));
  if (!order) return null;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  return { order, items };
}

export async function getAllOrders(): Promise<OrderWithItems[]> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase orders query failed: ${error.message}`);

    return (data ?? []).map((order) => ({
      id: order.id,
      code: order.code,
      customerName: order.customer_name,
      phone: order.phone,
      village: order.village,
      address: order.address,
      deliverySlot: order.delivery_slot,
      notes: order.notes,
      totalPkr: order.total_pkr,
      status: order.status,
      createdAt: new Date(order.created_at),
      items: (order.order_items ?? []).map((item: {
        id: number;
        order_id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        unit_price_pkr: number;
      }) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPricePkr: item.unit_price_pkr,
      })),
    }));
  }

  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const items = await db.select().from(orderItems);
  return rows.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id),
  }));
}
