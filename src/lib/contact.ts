import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from "@/lib/whatsapp";

export const DEFAULT_WHATSAPP_NUMBER = "03469586026";
const WHATSAPP_ASSET_KEY = "whatsapp-number";

export async function getWhatsAppNumber() {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("assets")
        .select("data,mime")
        .eq("key", WHATSAPP_ASSET_KEY)
        .maybeSingle();
      if (!error && data?.mime === "text/plain") {
        const number = Buffer.from(data.data, "base64").toString("utf8");
        if (isValidWhatsAppNumber(number)) return normalizeWhatsAppNumber(number);
      }
    }
  } catch {
    // Fall through to the local database or the default number.
  }

  try {
    const [row] = await db
      .select({ data: assets.data, mime: assets.mime })
      .from(assets)
      .where(eq(assets.key, WHATSAPP_ASSET_KEY));
    if (row?.mime === "text/plain") {
      const number = Buffer.from(row.data, "base64").toString("utf8");
      if (isValidWhatsAppNumber(number)) return normalizeWhatsAppNumber(number);
    }
  } catch {
    // Use the configured default when no database is available.
  }

  return DEFAULT_WHATSAPP_NUMBER;
}

export async function saveWhatsAppNumber(number: string) {
  const normalized = normalizeWhatsAppNumber(number);
  const data = Buffer.from(normalized, "utf8").toString("base64");
  const bytes = Buffer.byteLength(normalized, "utf8");
  const updatedAt = new Date();

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from("assets").upsert({
      key: WHATSAPP_ASSET_KEY,
      mime: "text/plain",
      data,
      bytes,
      updated_at: updatedAt.toISOString(),
    });
    if (!error) return normalized;
    throw new Error(`Could not save WhatsApp number: ${error.message}`);
  }

  await db
    .insert(assets)
    .values({ key: WHATSAPP_ASSET_KEY, mime: "text/plain", data, bytes, updatedAt })
    .onConflictDoUpdate({
      target: assets.key,
      set: { mime: "text/plain", data, bytes, updatedAt },
    });
  return normalized;
}
