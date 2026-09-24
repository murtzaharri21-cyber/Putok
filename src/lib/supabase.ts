import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAILS = [
  "murtzaharry21@gmail.com",
  "murtzaharri21@gmail.com",
] as const;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "PutokAdmin123!";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseServerConfig = Boolean(supabaseUrl && serviceRoleKey);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export function isAdminEmail(email: string | null | undefined) {
  return !!email && ADMIN_EMAILS.some((item) => item === email.trim().toLowerCase());
}
