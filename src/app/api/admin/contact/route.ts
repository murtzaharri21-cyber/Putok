import { cookies } from "next/headers";
import {
  getWhatsAppNumber,
  saveWhatsAppNumber,
} from "@/lib/contact";
import { isAdminEmail } from "@/lib/supabase";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const email = (await cookies()).get("putok_admin_session")?.value;
  return isAdminEmail(email);
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ number: await getWhatsAppNumber() });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const number = normalizeWhatsAppNumber(String(body.number ?? ""));
    if (!isValidWhatsAppNumber(number)) {
      return Response.json({ error: "Use a Pakistani mobile number like 03469586026." }, { status: 400 });
    }
    return Response.json({ number: await saveWhatsAppNumber(number) });
  } catch (error) {
    console.error("Save WhatsApp number error:", error);
    return Response.json({ error: "Could not save the WhatsApp number." }, { status: 500 });
  }
}
