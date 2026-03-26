import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode !== "apps") {
    return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("apps")
    .select("id, slug, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, apps: data || [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      appSlug,
      slug,
      title,
      artistName,
      producerNames,
      audioPath,
      coverImagePath,
      position,
      trackNumber,
      durationSeconds,
      durationLabel,
      displayDate,
      description,
      infoDescription,
      releaseStatus,
      isFeatured,
      lyricsBody
    } = body;

    if (!appSlug || !slug || !title || !artistName || !audioPath) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id, slug, name")
      .eq("slug", appSlug)
      .single();

    if (appError || !appRow) {
      return NextResponse.json(
        { ok: false, error: "App not found." },
        { status: 404 }
      );
    }

    const songPayload = {
      app_id: appRow.id,
      slug,
      title,
      artist_name: artistName,
      audio_path: audioPath,
      cover_image_path: coverImagePath || null,
      cover_image_bucket: coverImagePath ? "cover-art" : "cover-art",
      track_number: trackNumber ?? null,
      duration_seconds: durationSeconds ?? null,
      display_date: displayDate || null,
      duration_label: durationLabel || null,
      description: description || null,
      producer_names: producerNames || null,
      info_description: infoDescription || description || null,
      release_status: releaseStatus || "released",
      is_featured: Boolean(isFeatured),
      storage_bucket: "songs",
      source_app_slug: appRow.slug
    };

    const { data: songRow, error: songError } = await supabaseAdmin
      .from("songs")
      .upsert(songPayload, { onConflict: "slug" })
      .select("id, slug, title")
      .single();

    if (songError || !songRow) {
      return NextResponse.json(
        { ok: false, error: songError?.message || "Could not save song." },
        { status: 500 }
      );
    }

    const mappingPayload = {
      app_id: appRow.id,
      song_id: songRow.id,
      song_slug: songRow.slug,
      position: position ?? trackNumber ?? null
    };

    const { error: appSongError } = await supabaseAdmin
      .from("app_songs")
      .upsert(mappingPayload, { onConflict: "app_id,song_id" });

    if (appSongError) {
      return NextResponse.json(
        { ok: false, error: appSongError.message },
        { status: 500 }
      );
    }

    if (lyricsBody) {
      const { data: existingPrimary } = await supabaseAdmin
        .from("lyrics")
        .select("id")
        .eq("song_id", songRow.id)
        .eq("is_primary", true)
        .maybeSingle();

      if (existingPrimary?.id) {
        const { error: updateLyricsError } = await supabaseAdmin
          .from("lyrics")
          .update({
            body: lyricsBody,
            version_label: "final",
            is_primary: true
          })
          .eq("id", existingPrimary.id);

        if (updateLyricsError) {
          return NextResponse.json(
            { ok: false, error: updateLyricsError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: insertLyricsError } = await supabaseAdmin
          .from("lyrics")
          .insert({
            song_id: songRow.id,
            body: lyricsBody,
            version_label: "final",
            is_primary: true
          });

        if (insertLyricsError) {
          return NextResponse.json(
            { ok: false, error: insertLyricsError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      app: appRow,
      song: songRow
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
