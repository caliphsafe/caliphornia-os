import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

function cleanUsername(value: unknown) {
  return String(value || "").trim();
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session?.email) {
    return NextResponse.json(
      { ok: false, error: "You need to sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json();
  const username = cleanUsername(body?.username);
  const email = session.email.trim().toLowerCase();

  if (username.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Username must be at least 2 characters." },
      { status: 400 }
    );
  }

  if (username.length > 28) {
    return NextResponse.json(
      { ok: false, error: "Username must be 28 characters or less." },
      { status: 400 }
    );
  }

  const updateRes = await supabaseAdmin
    .from("app_users")
    .update({ username })
    .eq("email", email)
    .select("email, username, role")
    .maybeSingle();

  if (updateRes.error) {
    return NextResponse.json(
      { ok: false, error: updateRes.error.message },
      { status: 500 }
    );
  }

  if (updateRes.data) {
    return NextResponse.json({
      ok: true,
      user: updateRes.data,
    });
  }

  const insertRes = await supabaseAdmin
    .from("app_users")
    .insert({
      email,
      username,
      role: "user",
    })
    .select("email, username, role")
    .single();

  if (insertRes.error) {
    return NextResponse.json(
      { ok: false, error: insertRes.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: insertRes.data,
  });
}
