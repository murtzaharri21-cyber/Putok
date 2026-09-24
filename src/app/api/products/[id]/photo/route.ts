import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const [row] = await db.select().from(assets).where(eq(assets.key, `product-photo-${Number(id)}`));
    if (!row) return new Response(null, { status: 404 });
    const data = Buffer.from(row.data, "base64");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "no-store, max-age=0",
        "X-Product-Photo-Version": String(row.updatedAt.getTime()),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
