import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifySession } from "@/lib/session";
import { getSongPlaybackAccess } from "@/lib/access";

function getLyricsBody(lyrics: any): string {
  if (!lyrics) return "";

  if (Array.isArray(lyrics)) {
    const primary = lyrics.find((row: any) => row?.is_primary === true);
    return primary?.body || lyrics[0]?.body || "";
  }

  if (typeof lyrics === "object" && lyrics.body) {
    return lyrics.body;
  }

  return "";
}

async function createSignedSongUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("songs")
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("caliph_os_session")?.value ?? "";
    const session = verifySession(token);

    if (!session?.email) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", "fartherhood")
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "App not found." },
        { status: 404 }
      );
    }

    const { data: appSongs, error: appSongsError } = await supabaseAdmin
      .from("app_songs")
      .select(`
        position,
        songs (
          id,
          slug,
          title,
          artist_name,
          producer_names,
          display_date,
          duration_label,
          description,
          audio_path,
          preview_audio_path,
          preview_starts_at,
          preview_duration,
          release_at,
          early_access_at,
          is_locked,
          requires_project_access,
          requires_all_access,
          is_free_full_play,
          lyrics (
            body,
            is_primary
          )
        )
      `)
      .eq("app_id", appRow.id)
      .order("position", { ascending: true });

    if (appSongsError) {
      return NextResponse.json(
        { ok: false, error: appSongsError.message },
        { status: 500 }
      );
    }

    const normalized = await Promise.all(
      (appSongs || []).map(async (row: any) => {
        const song = Array.isArray(row.songs) ? row.songs[0] : row.songs;
        if (!song) return null;

        const playbackAccess = await getSongPlaybackAccess({
          userEmail: session.email,
          projectSlug: "fartherhood",
          song,
        });

        if (!playbackAccess.playbackPath) return null;

        const signedUrl = await createSignedSongUrl(playbackAccess.playbackPath);
        if (!signedUrl) return null;

        return {
          id: song.id,
          slug: song.slug,
          title: song.title,
          artistName: song.artist_name || "",
          producerNames: song.producer_names || "",
          date: song.display_date || "",
          duration: song.duration_label || "02:00",
          file: signedUrl,
          transcript: getLyricsBody(song.lyrics),
          description: playbackAccess.lockedReason || song.description || "",
          isPreview: playbackAccess.isPreview,
          canPlayFull: playbackAccess.canPlayFull,
          lockedReason: playbackAccess.lockedReason,
          clipStartSeconds: playbackAccess.clipStartSeconds,
          clipEndSeconds: playbackAccess.clipEndSeconds,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      tracks: normalized.filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
