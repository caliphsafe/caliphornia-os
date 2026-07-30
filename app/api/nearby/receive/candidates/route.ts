import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("guestToken") || "";
    const guest = await supabaseAdmin
      .from("guest_sessions")
      .select("id,status,expires_at")
      .eq("guest_token_hash", sha256(token))
      .maybeSingle();

    if (!guest.data?.id || new Date(guest.data.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "Receive session expired." }, { status: 401 });
    }

    const rows = await supabaseAdmin
      .from("nearby_share_sessions")
      .select("id,song_id,project_id,song_title_snapshot,project_name_snapshot,share_scope,sender_user_id,metadata,expires_at,status,created_at")
      .eq("status", "searching")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(12);

    const candidates = (rows.data || []).map((row: any) => {
      const songCount = Number(row.metadata?.share_count || row.metadata?.share_song_ids?.length || 1);
      const scope = String(row.share_scope || "song");
      const title =
        scope === "project"
          ? row.project_name_snapshot || row.song_title_snapshot || "Project share"
          : row.song_title_snapshot || "Shared song";

      return {
        id: row.id,
        scope,
        title,
        song_title: title,
        songCount,
        sender_label: row.metadata?.sender_label || "Caliphornia listener",
        expiresAt: row.expires_at,
        summary:
          scope === "project"
            ? `${songCount} songs, one listen per song`
            : "One full guest listen",
      };
    });

    return NextResponse.json({ ok: true, candidates });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not load Share candidates." },
      { status: 500 }
    );
  }
}
