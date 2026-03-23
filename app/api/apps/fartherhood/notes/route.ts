import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("song_notes")
      .select("id, display_name, note_body, created_at")
      .eq("app_slug", "fartherhood")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      notes: data || []
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = verifySession(cookieStore.get("caliph_os_session")?.value);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const displayName = String(body.displayName || "").trim();
    const noteBody = String(body.noteBody || "").trim();
    const songSlug = body.songSlug ? String(body.songSlug).trim() : null;

    if (!displayName || !noteBody) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    let songId: string | null = null;

    if (songSlug) {
      const { data: song, error: songError } = await supabaseAdmin
        .from("songs")
        .select("id")
        .eq("slug", songSlug)
        .maybeSingle();

      if (songError) {
        return NextResponse.json(
          { ok: false, error: songError.message },
          { status: 500 }
        );
      }

      songId = song?.id || null;
    }

    const { data, error } = await supabaseAdmin
      .from("song_notes")
      .insert({
        app_slug: "fartherhood",
        song_id: songId,
        user_email: session.email,
        display_name: displayName,
        note_body: noteBody
      })
      .select("id, display_name, note_body, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("event_logs").insert({
      user_email: session.email,
      event_type: "note_submit",
      app_slug: "fartherhood",
      song_id: songId,
      source_path: "/apps/fartherhood",
      metadata: {}
    });

    return NextResponse.json({
      ok: true,
      note: data
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}
