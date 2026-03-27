import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    return { ok: false as const, error: "Unauthorized.", status: 401 };
  }

  const { data: userRow, error } = await supabaseAdmin
    .from("app_users")
    .select("role")
    .eq("email", session.email)
    .maybeSingle();

  if (error || !userRow || userRow.role !== "admin") {
    return { ok: false as const, error: "Forbidden.", status: 403 };
  }

  return { ok: true as const, email: session.email };
}

function toNumberOrNull(value: FormDataEntryValue | string | null | undefined) {
  const raw = typeof value === "string" ? value.trim() : String(value || "").trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function toBool(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "") === "true";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const mode = request.nextUrl.searchParams.get("mode");

  try {
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
        .order("title", { ascending: true });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        songs: (data || []).map((row) => ({
          slug: row.slug,
          title: row.title,
          app_slug: row.source_app_slug || null
        }))
      });
    }

    if (mode === "song-detail") {
      const slug = request.nextUrl.searchParams.get("slug");
      if (!slug) {
        return NextResponse.json({ ok: false, error: "Missing slug." }, { status: 400 });
      }

      const [songRes, appSongRes, lyricRes, convoRes] = await Promise.all([
        supabaseAdmin
          .from("songs")
          .select(`
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
            source_app_slug,
            weather_location_name,
            weather_city,
            weather_region,
            weather_country,
            weather_lat,
            weather_lng,
            weather_timezone,
            weather_search_label,
            weather_sort_order,
            location_note
          `)
          .eq("slug", slug)
          .maybeSingle(),

        supabaseAdmin
          .from("app_songs")
          .select("position, app_slug")
          .eq("song_slug", slug)
          .maybeSingle(),

        supabaseAdmin
          .from("lyrics")
          .select("body")
          .eq("song_slug", slug)
          .maybeSingle(),

        supabaseAdmin
          .from("friends_conversations")
          .select(`
            slug,
            title,
            subtitle,
            list_preview,
            avatar_letter,
            last_activity_label,
            sort_order
          `)
          .eq("song_slug", slug)
          .maybeSingle()
      ]);

      if (songRes.error || !songRes.data) {
        return NextResponse.json(
          { ok: false, error: songRes.error?.message || "Song not found." },
          { status: 404 }
        );
      }

      let coverImageUrl: string | null = null;

      if (songRes.data.cover_image_path) {
        const { data: coverSigned } = await supabaseAdmin.storage
          .from("cover-art")
          .createSignedUrl(songRes.data.cover_image_path, 60 * 60);

        coverImageUrl = coverSigned?.signedUrl || null;
      }

      return NextResponse.json({
        ok: true,
        detail: {
          song: {
            ...songRes.data,
            cover_image_url: coverImageUrl
          },
          appSong: appSongRes.data || null,
          lyric: lyricRes.data || null,
          conversation: convoRes.data || null
        }
      });
    }

    if (mode === "app-order") {
      const appSlug = request.nextUrl.searchParams.get("appSlug");
      if (!appSlug) {
        return NextResponse.json({ ok: false, error: "Missing app slug." }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from("app_songs")
        .select("song_slug, position, songs(title)")
        .eq("app_slug", appSlug)
        .order("position", { ascending: true, nullsFirst: false });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        rows: (data || []).map((row: any) => ({
          song_slug: row.song_slug,
          title: row.songs?.title || row.song_slug,
          position: row.position
        }))
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid mode." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();

      if (body?.action === "save-order") {
        const appSlug = String(body.appSlug || "").trim();
        const rows = Array.isArray(body.rows) ? body.rows : [];

        if (!appSlug) {
          return NextResponse.json(
            { ok: false, error: "Missing app slug." },
            { status: 400 }
          );
        }

        for (const row of rows) {
          const songSlug = String(row.songSlug || "").trim();
          if (!songSlug) continue;

          const position =
            row.position === null || row.position === undefined || row.position === ""
              ? null
              : Number(row.position);

          const { error } = await supabaseAdmin
            .from("app_songs")
            .upsert(
              {
                app_slug: appSlug,
                song_slug: songSlug,
                position
              },
              { onConflict: "app_slug,song_slug" }
            );

          if (error) {
            return NextResponse.json(
              { ok: false, error: error.message },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
    }

    const formData = await request.formData();

    const mode = String(formData.get("mode") || "new");
    const selectedSongSlug = String(formData.get("selectedSongSlug") || "").trim();
    const appSlug = String(formData.get("appSlug") || "").trim();
    const slug = String(formData.get("slug") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const artistName = String(formData.get("artistName") || "").trim();
    const producerNames = String(formData.get("producerNames") || "").trim();
    const position = toNumberOrNull(formData.get("position"));
    const trackNumber = toNumberOrNull(formData.get("trackNumber"));
    const durationSeconds = toNumberOrNull(formData.get("durationSeconds"));
    const durationLabel = String(formData.get("durationLabel") || "").trim();
    const displayDate = String(formData.get("displayDate") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const isFeatured = toBool(formData.get("isFeatured"));
    const lyricsBody = String(formData.get("lyricsBody") || "");
    const audioPath = String(formData.get("audioPath") || "").trim();
    const coverImagePath = String(formData.get("coverImagePath") || "").trim();

    if (!appSlug || !slug || !title || !artistName) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (mode === "new" && !audioPath) {
      return NextResponse.json(
        { ok: false, error: "Audio path is required." },
        { status: 400 }
      );
    }

    const { data: appRow, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id, slug")
      .eq("slug", appSlug)
      .maybeSingle();

    if (appError || !appRow?.id) {
      return NextResponse.json(
        { ok: false, error: appError?.message || "App not found." },
        { status: 400 }
      );
    }

    const songPayload: Record<string, any> = {
      app_id: appRow.id,
      slug,
      title,
      artist_name: artistName || null,
      producer_names: producerNames || null,
      audio_path: audioPath || null,
      cover_image_path: coverImagePath || null,
      track_number: trackNumber,
      duration_seconds: durationSeconds,
      duration_label: durationLabel || null,
      display_date: displayDate || null,
      description: description || null,
      is_featured: isFeatured,
      source_app_slug: appSlug,
      storage_bucket: "songs",
      cover_image_bucket: "cover-art"
    };

    if (appSlug === "milia") {
      songPayload.weather_location_name =
        String(formData.get("weatherLocationName") || "").trim() || null;
      songPayload.weather_city =
        String(formData.get("weatherCity") || "").trim() || null;
      songPayload.weather_region =
        String(formData.get("weatherRegion") || "").trim() || null;
      songPayload.weather_country =
        String(formData.get("weatherCountry") || "").trim() || null;
      songPayload.weather_lat = toNumberOrNull(formData.get("weatherLat"));
      songPayload.weather_lng = toNumberOrNull(formData.get("weatherLng"));
      songPayload.weather_timezone =
        String(formData.get("weatherTimezone") || "").trim() || null;
      songPayload.weather_search_label =
        String(formData.get("weatherSearchLabel") || "").trim() || null;
      songPayload.weather_sort_order = toNumberOrNull(formData.get("weatherSortOrder"));
      songPayload.location_note =
        String(formData.get("locationNote") || "").trim() || null;
    }

    const { data: savedSong, error: songError } = await supabaseAdmin
      .from("songs")
      .upsert(songPayload, { onConflict: "slug" })
      .select("slug, title, source_app_slug")
      .maybeSingle();

    if (songError || !savedSong) {
      return NextResponse.json(
        { ok: false, error: songError?.message || "Could not save song." },
        { status: 500 }
      );
    }

    const { error: appSongError } = await supabaseAdmin
      .from("app_songs")
      .upsert(
        {
          app_slug: appSlug,
          song_slug: slug,
          position
        },
        { onConflict: "app_slug,song_slug" }
      );

    if (appSongError) {
      return NextResponse.json(
        { ok: false, error: appSongError.message },
        { status: 500 }
      );
    }

    const lyricsTrimmed = lyricsBody.trim();

    if (lyricsTrimmed) {
      const { error: lyricError } = await supabaseAdmin
        .from("lyrics")
        .upsert(
          {
            song_slug: slug,
            body: lyricsTrimmed
          },
          { onConflict: "song_slug" }
        );

      if (lyricError) {
        return NextResponse.json(
          { ok: false, error: lyricError.message },
          { status: 500 }
        );
      }
    } else if (mode === "edit") {
      await supabaseAdmin
        .from("lyrics")
        .delete()
        .eq("song_slug", slug);
    }

    const useConversationBuilder = toBool(formData.get("useConversationBuilder"));

    if (appSlug === "friends" && useConversationBuilder) {
      await supabaseAdmin
        .from("friends_conversations")
        .upsert(
          {
            song_slug: slug,
            slug,
            title,
            subtitle: artistName || null,
            list_preview: description || null
          },
          { onConflict: "song_slug" }
        );
    }

    return NextResponse.json({
      ok: true,
      song: savedSong
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
