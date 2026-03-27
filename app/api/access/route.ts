import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { signSession } from "@/lib/session";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const username = normalizeUsername(body.username || "");

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email." },
        { status: 400 }
      );
    }

    if (!username || !isValidUsername(username)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Username must be 3 to 30 characters and use only letters, numbers, or underscores."
        },
        { status: 400 }
      );
    }

    const { data: existingByUsername, error: usernameLookupError } = await supabaseAdmin
      .from("app_users")
      .select("id, email")
      .eq("username", username)
      .maybeSingle();

    if (usernameLookupError) {
      return NextResponse.json(
        { ok: false, error: usernameLookupError.message },
        { status: 500 }
      );
    }

    if (existingByUsername && existingByUsername.email !== email) {
      return NextResponse.json(
        { ok: false, error: "That username is already taken." },
        { status: 409 }
      );
    }

    const { error: upsertError } = await supabaseAdmin.from("app_users").upsert(
      {
        email,
        username,
        last_login_at: new Date().toISOString()
      },
      {
        onConflict: "email"
      }
    );

    if (upsertError) {
      return NextResponse.json(
        { ok: false, error: upsertError.message },
        { status: 500 }
      );
    }

    const { data: userRow, error: userRowError } = await supabaseAdmin
      .from("app_users")
      .select("email, username, role")
      .eq("email", email)
      .single();

    if (userRowError || !userRow) {
      return NextResponse.json(
        { ok: false, error: userRowError?.message || "Could not load user." },
        { status: 500 }
      );
    }

    const token = signSession({
      email: userRow.email,
      username: userRow.username || username,
      role: userRow.role || "user",
      iat: Date.now()
    });

    const response = NextResponse.json({
      ok: true,
      username: userRow.username || username,
      email: userRow.email,
      role: userRow.role || "user"
    });

    response.cookies.set("caliph_os_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
