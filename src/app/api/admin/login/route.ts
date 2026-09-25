import { cookies } from "next/headers";
import { ADMIN_PASSWORD, isAdminEmail } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!isAdminEmail(email) || password !== ADMIN_PASSWORD) {
      return Response.json(
        { error: "Invalid admin credentials. Use one of the approved admin emails." },
        { status: 401 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("putok_admin_session", email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return Response.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}
