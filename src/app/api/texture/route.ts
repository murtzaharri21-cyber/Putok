import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const KEY = "putok-photo";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const noStore = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    const [row] = await db.select().from(assets).where(eq(assets.key, KEY));
    if (row) {
      const buf = Buffer.from(row.data, "base64");
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": row.mime,
          "Content-Length": String(buf.length),
          "X-Putok-Source": "upload",
          "X-Putok-Version": String(row.updatedAt.getTime()),
          ...noStore,
        },
      });
    }
  } catch (err) {
    console.error(err);
  }
  // Fallback to the bundled photo
  const file = await readFile(path.join(process.cwd(), "public", "textures", "putok-top.jpg"));
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(file.length),
      "X-Putok-Source": "fallback",
      ...noStore,
    },
  });
}

export async function POST(req: Request) {
  try {
    const email = (await cookies()).get("putok_admin_session")?.value;
    if (!isAdminEmail(email)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return Response.json({ error: "Attach a photo." }, { status: 400 });
    }
    const mime = file.type || "image/jpeg";
    if (!ALLOWED.has(mime)) {
      return Response.json({ error: "Use a JPG, PNG or WebP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "That photo is over 12 MB. Shrink it a little." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const data = buf.toString("base64");
    const now = new Date();
    await db
      .insert(assets)
      .values({ key: KEY, mime, data, bytes: buf.length, updatedAt: now })
      .onConflictDoUpdate({
        target: assets.key,
        set: { mime, data, bytes: buf.length, updatedAt: now },
      });
    return Response.json({ ok: true, bytes: buf.length, version: now.getTime() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const email = (await cookies()).get("putok_admin_session")?.value;
  if (!isAdminEmail(email)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await db.delete(assets).where(eq(assets.key, KEY));
  return Response.json({ ok: true });
}

export async function HEAD() {
  const [row] = await db
    .select({ updatedAt: assets.updatedAt, bytes: assets.bytes })
    .from(assets)
    .where(eq(assets.key, KEY));
  return new Response(null, {
    headers: {
      "X-Putok-Source": row ? "upload" : "fallback",
      "X-Putok-Version": row ? String(row.updatedAt.getTime()) : "0",
      ...noStore,
    },
  });
}
