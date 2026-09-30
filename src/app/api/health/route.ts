import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hasSupabaseServerConfig, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diagnostics = {
    hasUrl: Boolean(url),
    urlPrefix: url ? url.slice(0, 15) : null,
    hasAnonKey: Boolean(anon),
    anonKeyLength: anon ? anon.length : 0,
    hasServiceRoleKey: Boolean(serviceKey),
    serviceKeyLength: serviceKey ? serviceKey.length : 0,
    hasSupabaseServerConfig,
    hasSupabaseAdmin: Boolean(supabaseAdmin),
    hasDbUrl: Boolean(process.env.DATABASE_URL),
  };

  try {
    if (hasSupabaseServerConfig && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from("products").select("id").limit(1);
      if (error) {
        return Response.json({ ok: false, database: "supabase", error: error.message, diagnostics }, { status: 500 });
      }
      return Response.json({ ok: true, database: "supabase", diagnostics });
    }

    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "postgres", diagnostics });
  } catch (err: any) {
    return Response.json({ ok: false, database: "unavailable", error: err?.message, diagnostics }, { status: 503 });
  }
}

