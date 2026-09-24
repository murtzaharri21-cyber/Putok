import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hasSupabaseServerConfig, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (hasSupabaseServerConfig && supabaseAdmin) {
      const { error } = await supabaseAdmin.from("products").select("id").limit(1);
      if (error) throw error;
      return Response.json({ ok: true, database: "supabase" });
    }

    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "postgres" });
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
