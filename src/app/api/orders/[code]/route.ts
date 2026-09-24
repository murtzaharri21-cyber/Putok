import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ORDER_STATUSES, orders, type OrderStatus } from "@/db/schema";
import { getOrderByCode } from "@/db/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const result = await getOrderByCode(code.toUpperCase());
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(result);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  const [updated] = await db
    .update(orders)
    .set({ status })
    .where(eq(orders.code, code.toUpperCase()))
    .returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ order: updated });
}
