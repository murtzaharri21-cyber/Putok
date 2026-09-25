import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { ensureSeeded, getAllOrders } from "@/db/queries";
import { hasSupabaseServerConfig, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VILLAGES = new Set([
  "Chamangul",
  "Gulmit",
  "Karimabad",
  "Aliabad",
  "Altit",
  "Ganish",
  "Hyderabad",
  "Murtazabad",
  "Hassanabad",
  "Dorkhan",
  "Other",
]);

const SLOTS = new Set(["07:00-08:00", "08:00-09:00", "09:00-10:00"]);

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "PK-";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

type IncomingItem = { productId: number; quantity: number };

export async function POST(req: Request) {
  try {
    if (!hasSupabaseServerConfig && !process.env.DATABASE_URL) {
      return Response.json(
        { error: "Orders are temporarily unavailable. Configure Supabase in .env.local first." },
        { status: 503 },
      );
    }
    const body = await req.json();

    const customerName = String(body.customerName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const village = String(body.village ?? "").trim();
    const address = String(body.address ?? "").trim();
    const deliverySlot = String(body.deliverySlot ?? "").trim();
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2) {
      return Response.json({ error: "Please tell us your name." }, { status: 400 });
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
      return Response.json({ error: "That phone number doesn't look right." }, { status: 400 });
    }
    if (!VILLAGES.has(village)) {
      return Response.json({ error: "Pick a village we deliver to." }, { status: 400 });
    }
    if (address.length < 4) {
      return Response.json({ error: "Add a landmark or house description." }, { status: 400 });
    }
    if (!SLOTS.has(deliverySlot)) {
      return Response.json({ error: "Choose a delivery hour." }, { status: 400 });
    }

    const cleanItems = items
      .map((i) => ({
        productId: Number(i.productId),
        quantity: Math.floor(Number(i.quantity)),
      }))
      .filter((i) => Number.isInteger(i.productId) && i.quantity > 0 && i.quantity <= 50);

    if (cleanItems.length === 0) {
      return Response.json({ error: "Your basket is empty." }, { status: 400 });
    }

    let lines: Array<{
      productId: number;
      productName: string;
      quantity: number;
      unitPricePkr: number;
    }>;

    if (hasSupabaseServerConfig && supabaseAdmin) {
      const { data: catalogue, error } = await supabaseAdmin
        .from("products")
        .select("id,name,price_pkr,available")
        .in("id", cleanItems.map((i) => i.productId));
      if (error) throw new Error(`Supabase products query failed: ${error.message}`);

      lines = cleanItems.map((i) => {
        const p = catalogue?.find((c) => c.id === i.productId && c.available);
        if (!p) throw new Error("Unknown product");
        return {
          productId: p.id,
          productName: p.name,
          quantity: i.quantity,
          unitPricePkr: p.price_pkr,
        };
      });
    } else {
      await ensureSeeded();
      const catalogue = await db
        .select()
        .from(products)
        .where(inArray(products.id, cleanItems.map((i) => i.productId)));

      lines = cleanItems.map((i) => {
        const p = catalogue.find((c) => c.id === i.productId && c.available);
        if (!p) throw new Error("Unknown product");
        return {
          productId: p.id,
          productName: p.name,
          quantity: i.quantity,
          unitPricePkr: p.pricePkr,
        };
      });
    }

    const totalPkr = lines.reduce((s, l) => s + l.quantity * l.unitPricePkr, 0);

    if (hasSupabaseServerConfig && supabaseAdmin) {
      const code = makeCode();
      const { data: created, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          code,
          customer_name: customerName,
          phone,
          village,
          address,
          delivery_slot: deliverySlot,
          notes: notes || null,
          total_pkr: totalPkr,
        })
        .select("id,code")
        .single();
      if (orderError || !created) throw new Error(`Supabase order insert failed: ${orderError?.message ?? "unknown error"}`);

      const { error: itemError } = await supabaseAdmin.from("order_items").insert(
        lines.map((line) => ({
          order_id: created.id,
          product_id: line.productId,
          product_name: line.productName,
          quantity: line.quantity,
          unit_price_pkr: line.unitPricePkr,
        })),
      );
      if (itemError) throw new Error(`Supabase order items insert failed: ${itemError.message}`);
      return Response.json({ code: created.code, totalPkr }, { status: 201 });
    }

    const created = await db.transaction(async (tx) => {
      let code = makeCode();
      // Extremely unlikely, but keep codes unique.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [row] = await tx
            .insert(orders)
            .values({
              code,
              customerName,
              phone,
              village,
              address,
              deliverySlot,
              notes: notes || null,
              totalPkr,
            })
            .returning();
          await tx.insert(orderItems).values(
            lines.map((l) => ({ ...l, orderId: row.id })),
          );
          return row;
        } catch (e) {
          code = makeCode();
          if (attempt === 2) throw e;
        }
      }
      throw new Error("Could not create order");
    });

    return Response.json({ code: created.code, totalPkr }, { status: 201 });
  } catch (err) {
    console.error(err);
    if (err instanceof Error && err.message.includes("Could not find the table")) {
      return Response.json(
        { error: "Supabase tables are not set up yet. Run supabase/schema.sql in Supabase SQL Editor." },
        { status: 503 },
      );
    }
    return Response.json({ error: "Something went wrong at Azra's home kitchen. Try again." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const list = await getAllOrders();
    return Response.json({ orders: list });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Could not load orders" }, { status: 500 });
  }
}
