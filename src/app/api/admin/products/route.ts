import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getProducts } from "@/db/queries";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const email = (await cookies()).get("putok_admin_session")?.value;
  return isAdminEmail(email);
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from("products").select("*").order("sort_order");
      if (!error && data) return Response.json({ products: data });
    }

    const list = await db.select().from(products).orderBy(asc(products.sortOrder));
    return Response.json({ products: list });
  } catch (error) {
    console.error("Admin list products error:", error);
    return Response.json({ products: await getProducts() });
  }
}

function productPayload(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();
  const tagline = String(body.tagline ?? "").trim();
  const pieces = Math.floor(Number(body.pieces));
  const pricePkr = Math.floor(Number(body.pricePkr));
  const sortOrder = Math.floor(Number(body.sortOrder ?? 0));
  const available = body.available !== false;

  if (name.length < 2 || slug.length < 2 || tagline.length < 2) throw new Error("Name, slug and tagline are required.");
  if (!Number.isInteger(pieces) || pieces < 1 || pieces > 100) throw new Error("Pieces must be between 1 and 100.");
  if (!Number.isInteger(pricePkr) || pricePkr < 0) throw new Error("Price must be a positive number.");

  return { name, slug, tagline, pieces, pricePkr, sortOrder, available };
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = productPayload(await req.json());

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from("products").insert({
        ...payload,
        price_pkr: payload.pricePkr,
        sort_order: payload.sortOrder,
      }).select().single();
      if (!error && data) return Response.json({ product: data }, { status: 201 });
    }

    const [product] = await db.insert(products).values(payload).returning();
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create product";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid product id" }, { status: 400 });
    const payload = productPayload(body);

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from("products").update({
        ...payload,
        price_pkr: payload.pricePkr,
        sort_order: payload.sortOrder,
      }).eq("id", id).select().single();
      if (!error && data) return Response.json({ product: data });
    }

    const [product] = await db.update(products).set(payload).where(eq(products.id, id)).returning();
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update product";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    const productId = Number(id);
    if (!Number.isInteger(productId)) return Response.json({ error: "Invalid product id" }, { status: 400 });

    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from("products").delete().eq("id", productId);
      if (!error) return Response.json({ ok: true });
    }

    await db.delete(products).where(eq(products.id, productId));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return Response.json({ error: "Could not delete product" }, { status: 500 });
  }
}
