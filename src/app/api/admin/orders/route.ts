import { cookies } from "next/headers";
import { getAllOrders } from "@/db/queries";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function loadOrders() {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map((row) => ({
          ...row,
          customer_name: row.customer_name ?? row.customerName,
          total_pkr: row.total_pkr ?? row.totalPkr,
          created_at: row.created_at ?? row.createdAt,
          delivery_slot: row.delivery_slot ?? row.deliverySlot,
          items: (row.order_items ?? row.items ?? []).map((item: any) => ({
            ...item,
            product_name: item.product_name ?? item.productName,
            unit_price_pkr: item.unit_price_pkr ?? item.unitPricePkr,
          })),
        }));
      }
      if (error) {
        console.error("Supabase loadOrders error:", error);
      }
    } catch (e) {
      console.error("Supabase loadOrders exception:", e);
    }
  }

  const all = await getAllOrders();
  return all.map((row: any) => ({
    ...row,
    customer_name: row.customer_name ?? row.customerName,
    total_pkr: row.total_pkr ?? row.totalPkr,
    created_at: row.created_at ?? row.createdAt,
    delivery_slot: row.delivery_slot ?? row.deliverySlot,
    items: (row.items ?? []).map((item: any) => ({
      ...item,
      product_name: item.product_name ?? item.productName,
      unit_price_pkr: item.unit_price_pkr ?? item.unitPricePkr,
    })),
  }));
}

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("putok_admin_session")?.value ?? null;

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await loadOrders();
    return Response.json({ orders });
  } catch (error) {
    console.error("Admin list orders error:", error);
    return Response.json({ orders: [] });
  }
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const email = cookieStore.get("putok_admin_session")?.value ?? null;

  if (!isAdminEmail(email)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.id);
    const status = String(body.status ?? "");

    if (!Number.isFinite(orderId) || !status) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .select();

      if (!error && data && data[0]) {
        return Response.json({ order: data[0] });
      }
    }

    const { db } = await import("@/db");
    const { orders } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, orderId)).returning();

    if (!updated) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    return Response.json({ order: updated });
  } catch (error) {
    console.error("Admin update order error:", error);
    return Response.json({ error: "Could not update order" }, { status: 500 });
  }
}
