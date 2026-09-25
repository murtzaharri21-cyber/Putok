import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/supabase";
import { deleteAsset, getAsset, saveAsset } from "@/lib/assets";

export const dynamic = "force-dynamic";

const KEY = "putok-photo";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const FALLBACK_TEXTURE = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#f5e4b7"/>
    <circle cx="64" cy="64" r="54" fill="#c9823f"/>
    <circle cx="64" cy="64" r="47" fill="#e9b567"/>
    <circle cx="64" cy="64" r="35" fill="#f3cc83"/>
    <path d="M64 18v92M18 64h92M31 31l66 66M97 31 31 97" stroke="#b87034" stroke-width="4" stroke-linecap="round" opacity=".65"/>
    <circle cx="64" cy="64" r="9" fill="#d8944d"/>
  </svg>
`.trim());

const noStore = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    const row = await getAsset(KEY);
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
  return new Response(new Uint8Array(FALLBACK_TEXTURE), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Length": String(FALLBACK_TEXTURE.length),
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
    await saveAsset({ key: KEY, mime, data, bytes: buf.length, updatedAt: now });
    return Response.json({ ok: true, bytes: buf.length, version: now.getTime() });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const email = (await cookies()).get("putok_admin_session")?.value;
  if (!isAdminEmail(email)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await deleteAsset(KEY);
  return Response.json({ ok: true });
}

export async function HEAD() {
  const row = await getAsset(KEY);
  return new Response(null, {
    headers: {
      "X-Putok-Source": row ? "upload" : "fallback",
      "X-Putok-Version": row ? String(row.updatedAt.getTime()) : "0",
      ...noStore,
    },
  });
}
