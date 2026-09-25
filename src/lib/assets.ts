import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { supabaseAdmin } from "@/lib/supabase";

export type StoredAsset = {
  key: string;
  mime: string;
  data: string;
  bytes: number;
  updatedAt: Date;
};

function fromSupabaseAsset(asset: {
  key: string;
  mime: string;
  data: string;
  bytes: number;
  updated_at: string;
}): StoredAsset {
  return {
    key: asset.key,
    mime: asset.mime,
    data: asset.data,
    bytes: asset.bytes,
    updatedAt: new Date(asset.updated_at),
  };
}

export async function getAsset(key: string): Promise<StoredAsset | null> {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("assets")
      .select("key,mime,data,bytes,updated_at")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`Supabase asset query failed: ${error.message}`);
    return data ? fromSupabaseAsset(data) : null;
  }

  const [asset] = await db.select().from(assets).where(eq(assets.key, key));
  return asset ?? null;
}

export async function saveAsset(asset: Omit<StoredAsset, "updatedAt"> & { updatedAt?: Date }) {
  const updatedAt = asset.updatedAt ?? new Date();
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from("assets").upsert({
      key: asset.key,
      mime: asset.mime,
      data: asset.data,
      bytes: asset.bytes,
      updated_at: updatedAt.toISOString(),
    });
    if (error) throw new Error(`Supabase asset save failed: ${error.message}`);
    return updatedAt;
  }

  await db
    .insert(assets)
    .values({ ...asset, updatedAt })
    .onConflictDoUpdate({
      target: assets.key,
      set: { mime: asset.mime, data: asset.data, bytes: asset.bytes, updatedAt },
    });
  return updatedAt;
}

export async function deleteAsset(key: string) {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from("assets").delete().eq("key", key);
    if (error) throw new Error(`Supabase asset delete failed: ${error.message}`);
    return;
  }

  await db.delete(assets).where(eq(assets.key, key));
}
