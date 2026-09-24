import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { isAdminEmail } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const email = (await cookies()).get("putok_admin_session")?.value;
  if (!isAdminEmail(email)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const productId = Number(form.get("productId"));
    const file = form.get("photo");
    if (!Number.isInteger(productId) || productId < 1) return Response.json({ error: "Invalid product" }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "Attach a photo." }, { status: 400 });
    if (!ALLOWED.has(file.type)) return Response.json({ error: "Use a JPG, PNG or WebP." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "That photo is over 12 MB." }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const now = new Date();
    await db.insert(assets).values({
      key: `product-photo-${productId}`,
      mime: file.type,
      data: buf.toString("base64"),
      bytes: buf.length,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: assets.key,
      set: { mime: file.type, data: buf.toString("base64"), bytes: buf.length, updatedAt: now },
    });

    return Response.json({ ok: true, version: now.getTime() });
  } catch (error) {
    console.error("Product photo upload error:", error);
    return Response.json({ error: "Photo upload failed." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const email = (await cookies()).get("putok_admin_session")?.value;
  if (!isAdminEmail(email)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { productId } = await req.json().catch(() => ({}));
  await db.delete(assets).where(eq(assets.key, `product-photo-${Number(productId)}`));
  return Response.json({ ok: true });
}
