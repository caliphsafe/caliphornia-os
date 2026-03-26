import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "apps") {
    const { data, error } = await supabaseAdmin
      .from("apps")
      .select("id, slug, name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, apps: data || [] });
  }

  if (mode === "songs") {
    const { data, error } = await supabaseAdmin
      .from("songs")
      .select("slug, title, source_app_slug")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      songs: (data || []).map((row) => ({
        slug: row.slug,
        title: row.title,
        app_slug: row.source_app_slug
      }))
    });
  }

  if (mode === "song-detail") {
    const slug = request.nextUrl.searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ ok: false, error: "Missing slug." }, { status: 400 });
    }

    const { data: song, error: songError } = await supabaseAdmin
      .from("songs")
      .select(`
        id,
        slug,
        title,
        artist_name,
        producer_names,
        audio_path,
        cover_image_path,
        track_number,
        duration_seconds,
        duration_label,
        display_date,
        description,
        is_featured,
        source_app_slug
      `)
      .eq("slug", slug)
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { ok: false, error: songError?.message || "Song not found." },
        { status: 404 }
      );
    }

    const { data: appSong } = await supabaseAdmin
      .from("app_songs")
      .select(`
        position,
        apps ( slug )
      `)
      .eq("song_id", song.id)
      .maybeSingle();

    const { data: lyric } = await supabaseAdmin
      .from("lyrics")
      .select("body")
      .eq("song_id", song.id)
      .eq("is_primary", true)
      .maybeSingle();

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select(`
        slug,
        title,
        subtitle,
        list_preview,
        avatar_letter,
        last_activity_label,
        sort_order
      `)
      .eq("primary_song_id", song.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      detail: {
        song,
        appSong: appSong
          ? {
              position: appSong.position,
              app_slug: Array.isArray(appSong.apps)
                ? appSong.apps[0]?.slug || null
                : (appSong.apps as any)?.slug || null
            }
          : null,
        lyric: lyric || null,
        conversation: conversation || null
      }
    });
  }

  if (mode === "app-order") {
    const appSlug = request.nextUrl.searchParams.get("appSlug");

    if (!appSlug) {
      return NextResponse.json({ ok: false, error: "Missing appSlug." }, { status: 400 });
    }

    const { data: app } = await supabaseAdmin
      .from("apps")
      .select("id")
      .eq("slug", appSlug)
      .single();

    if (!app) {
      return NextResponse.json({ ok: false, error: "App not found." }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("app_songs")
      .select(`
        position,
        song_slug,
        songs (
          title
        )
      `)
      .eq("app_id", app.id)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rows: (data || []).map((row: any) => ({
        song_slug: row.song_slug,
        title: Array.isArray(row.songs)
          ? row.songs[0]?.title || row.song_slug
          : row.songs?.title || row.song_slug,
        position: row.position
      }))
    });
  }

  return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();

    if (body.action === "save-order") {
      const { appSlug, rows } = body;

      const { data: app } = await supabaseAdmin
        .from("apps")
        .select("id")
        .eq("slug", appSlug)
        .single();

      if (!app) {
        return NextResponse.json({ ok: false, error: "App not found." }, { status: 404 });
      }

      for (const row of rows || []) {
        const { error } = await supabaseAdmin
          .from("app_songs")
          .update({ position: row.position })
          .eq("app_id", app.id)
          .eq("song_slug", row.songSlug);

        if (error) {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  try {
    const formData = await request.formData();

    const mode = String(formData.get("mode") || "new");
    const selectedSongSlug = String(formData.get("selectedSongSlug") || "").trim();

    const appSlug = String(formData.get("appSlug") || "").trim();
    const inputSlug = String(formData.get("slug") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const artistName = String(formData.get("artistName") || "").trim();
    const producerNames = String(formData.get("producerNames") || "").trim();
    const position = String(formData.get("position") || "").trim();
    const trackNumber = String(formData.get("trackNumber") || "").trim();
    const durationSeconds = String(formData.get("durationSeconds") || "").trim();
    const durationLabel = String(formData.get("durationLabel") || "").trim();
    const displayDate = String(formData.get("displayDate") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const isFeatured = String(formData.get("isFeatured") || "") === "true";
    const lyricsBody = String(formData.get("lyricsBody") || "").trim();

    const audioFile = formData.get("audioFile");
    const coverFile = formData.get("coverFile");

    if (!appSlug || !title || !artistName) {
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

    const songSlug = slugify(inputSlug || title);
    if (!songSlug) {
      return NextResponse.json(
        { ok: false, error: "Could not generate song slug." },
        { status: 400 }
      );
    }

    let existingSong: any = null;

    if (mode === "edit") {
      const lookupSlug = selectedSongSlug || songSlug;
      const { data } = await supabaseAdmin
        .from("songs")
        .select("id, audio_path, cover_image_path")
        .eq("slug", lookupSlug)
        .maybeSingle();

      existingSong = data || null;
    }

    let audioPath = existingSong?.audio_path || null;

    if (audioFile instanceof File && audioFile.size > 0) {
      const audioExt = (audioFile.name.split(".").pop() || "mp3").toLowerCase();
      audioPath = `${appRow.slug}/${songSlug}/${songSlug}-final.${safeFileName(audioExt)}`;

      const audioUpload = await supabaseAdmin.storage
        .from("songs")
        .upload(audioPath, audioFile, {
          upsert: true,
          contentType: audioFile.type || undefined
        });

      if (audioUpload.error) {
        return NextResponse.json(
          { ok: false, error: audioUpload.error.message },
          { status: 500 }
        );
      }
    }

    if (!audioPath) {
      return NextResponse.json(
        { ok: false, error: "Audio file is required for new songs." },
        { status: 400 }
      );
    }

    let coverImagePath = existingSong?.cover_image_path || null;

    if (coverFile instanceof File && coverFile.size > 0) {
      const coverExt = (coverFile.name.split(".").pop() || "png").toLowerCase();
      coverImagePath = `${appRow.slug}/${songSlug}/${songSlug}.${safeFileName(coverExt)}`;

      const coverUpload = await supabaseAdmin.storage
        .from("cover-art")
        .upload(coverImagePath, coverFile, {
          upsert: true,
          contentType: coverFile.type || undefined
        });

      if (coverUpload.error) {
        return NextResponse.json(
          { ok: false, error: coverUpload.error.message },
          { status: 500 }
        );
      }
    }

    const songPayload = {
      app_id: appRow.id,
      slug: songSlug,
      title,
      artist_name: artistName,
      audio_path: audioPath,
      cover_image_path: coverImagePath,
      cover_image_bucket: "cover-art",
      track_number: trackNumber ? Number(trackNumber) : null,
      duration_seconds: durationSeconds ? Number(durationSeconds) : null,
      display_date: displayDate || null,
      duration_label: durationLabel || null,
      description: description || null,
      producer_names: producerNames || null,
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

    const { error: appSongError } = await supabaseAdmin
      .from("app_songs")
      .upsert(
        {
          app_id: appRow.id,
          song_id: songRow.id,
          song_slug: songRow.slug,
          position: position ? Number(position) : trackNumber ? Number(trackNumber) : null
        },
        { onConflict: "app_id,song_id" }
      );

    if (appSongError) {
      return NextResponse.json(
        { ok: false, error: appSongError.message },
        { status: 500 }
      );
    }

    const { data: existingLyric } = await supabaseAdmin
      .from("lyrics")
      .select("id")
      .eq("song_id", songRow.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (lyricsBody) {
      if (existingLyric?.id) {
        const { error: lyricUpdateError } = await supabaseAdmin
          .from("lyrics")
          .update({
            body: lyricsBody,
            version_label: "final",
            is_primary: true
          })
          .eq("id", existingLyric.id);

        if (lyricUpdateError) {
          return NextResponse.json(
            { ok: false, error: lyricUpdateError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: lyricInsertError } = await supabaseAdmin
          .from("lyrics")
          .insert({
            song_id: songRow.id,
            body: lyricsBody,
            version_label: "final",
            is_primary: true
          });

        if (lyricInsertError) {
          return NextResponse.json(
            { ok: false, error: lyricInsertError.message },
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
