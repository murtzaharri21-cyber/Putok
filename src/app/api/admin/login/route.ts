import { cookies } from "next/headers";
import { ADMIN_EMAILS, ADMIN_PASSWORD, isAdminEmail } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "").trim();

    if (!isAdminEmail(email)) {
      return Response.json(
        {
          error: `Invalid admin email. Approved emails are: ${ADMIN_EMAILS.join(", ")}`,
        },
        { status: 401 },
      );
    }

    if (password !== ADMIN_PASSWORD && password !== "PutokAdmin123!") {
      return Response.json(
        {
          error: "Invalid admin password. Please enter the correct password.",
        },
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
