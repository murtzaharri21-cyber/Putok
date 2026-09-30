import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAILS = [
  "murtzaharry21@gmail.com",
  "murtzaharri21@gmail.com",
] as const;

export const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim() || "PutokAdmin123!";

const defaultSupabaseUrl = "https://zgkljhbuilnuwaurbfus.supabase.co";
const defaultAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2xqaGJ1aWxudXdhdXJiZnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTkyMjgsImV4cCI6MjEwNTgzNTIyOH0.1vhOQCePHYlhyAmeFg6B60rsPv7vdotZ7DcKqRfzDDw";
const defaultServiceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2xqaGJ1aWxudXdhdXJiZnVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI1OTIyOCwiZXhwIjoyMTA1ODM1MjI4fQ.us6IEbit5QDl7FwGqFSALuMuCDD0KLa-3rgoGFxkbGc";

const supabaseUrl =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim() ||
  defaultSupabaseUrl;
const supabaseAnonKey =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim() ||
  defaultAnonKey;
const serviceRoleKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() || defaultServiceRoleKey;

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
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const envEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return ADMIN_EMAILS.some((item) => item.toLowerCase() === normalized) || envEmails.includes(normalized);
}
