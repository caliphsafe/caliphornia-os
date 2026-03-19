import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { signSession } from "@/lib/session";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("app_users").upsert(
      {
        email,
        last_login_at: new Date().toISOString()
      },
      {
        onConflict: "email"
      }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const token = signSession({
      email,
      iat: Date.now()
    });

    const cookieStore = await cookies();
    cookieStore.set("caliph_os_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
