import { cookies } from "next/headers";
import { getAllOrders } from "@/db/queries";
import { ADMIN_EMAILS, isAdminEmail, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function loadOrders() {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.from("orders").select("*, order_items(*)");
      if (!error && data) {
        return data.map((row) => ({
          ...row,
          items: row.order_items ?? [],
        }));
      }
    } catch {
      // fallback below
    }
  }

  return await getAllOrders();
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
