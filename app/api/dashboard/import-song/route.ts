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
    const formData = await request.formData();

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
    const infoDescription = String(formData.get("infoDescription") || "").trim();
    const releaseStatus = String(formData.get("releaseStatus") || "").trim() || "released";
    const isFeatured = String(formData.get("isFeatured") || "") === "true";
    const lyricsBody = String(formData.get("lyricsBody") || "").trim();

    const createConversation = String(formData.get("createConversation") || "") === "true";
    const conversationSlugInput = String(formData.get("conversationSlug") || "").trim();
    const conversationTitle = String(formData.get("conversationTitle") || "").trim();
    const conversationSubtitle = String(formData.get("conversationSubtitle") || "").trim();
    const listPreview = String(formData.get("listPreview") || "").trim();
    const avatarLetter = String(formData.get("avatarLetter") || "").trim();
    const lastActivityLabel = String(formData.get("lastActivityLabel") || "").trim();
    const sortOrder = String(formData.get("sortOrder") || "").trim();
    const conversationArtistNames = String(formData.get("conversationArtistNames") || "").trim();
    const conversationProducerNames = String(formData.get("conversationProducerNames") || "").trim();
    const conversationInfoDescription = String(formData.get("conversationInfoDescription") || "").trim();

    const audioFile = formData.get("audioFile");
    const coverFile = formData.get("coverFile");

    if (!appSlug || !title || !artistName || !(audioFile instanceof File)) {
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

    const audioExt = (audioFile.name.split(".").pop() || "mp3").toLowerCase();
    const audioPath = `${appRow.slug}/${songSlug}/${songSlug}-final.${safeFileName(audioExt)}`;

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

    let coverImagePath: string | null = null;

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
      info_description: infoDescription || description || null,
      release_status: releaseStatus,
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

    let conversationRow: any = null;

    if (appRow.slug === "friends" && createConversation) {
      const conversationSlug = slugify(conversationSlugInput || title);

      const conversationPayload = {
        app_id: appRow.id,
        slug: conversationSlug,
        title: conversationTitle || title,
        subtitle: conversationSubtitle || artistName,
        is_published: true,
        avatar_letter: (avatarLetter || title[0] || "F").slice(0, 1),
        list_preview: listPreview || null,
        last_activity_label: lastActivityLabel || null,
        sort_order: sortOrder ? Number(sortOrder) : null,
        cover_image_path: coverImagePath,
        cover_image_bucket: "cover-art",
        primary_song_id: songRow.id,
        artist_names: conversationArtistNames || artistName,
        producer_names: conversationProducerNames || producerNames || null,
        info_description: conversationInfoDescription || infoDescription || description || null
      };

      const { data: savedConversation, error: conversationError } = await supabaseAdmin
        .from("conversations")
        .upsert(conversationPayload, { onConflict: "slug" })
        .select("id, slug, title")
        .single();

      if (conversationError || !savedConversation) {
        return NextResponse.json(
          { ok: false, error: conversationError?.message || "Could not save conversation." },
          { status: 500 }
        );
      }

      conversationRow = savedConversation;

      const { data: existingFinalAsset } = await supabaseAdmin
        .from("audio_assets")
        .select("id")
        .eq("conversation_id", savedConversation.id)
        .eq("is_final_version", true)
        .maybeSingle();

      if (existingFinalAsset?.id) {
        const { error: updateAssetError } = await supabaseAdmin
          .from("audio_assets")
          .update({
            slug: songRow.slug,
            title: songRow.title,
            storage_path: audioPath,
            version_label: "Final",
            is_final_version: true,
            is_playlistable: true,
            linked_song_id: songRow.id
          })
          .eq("id", existingFinalAsset.id);

        if (updateAssetError) {
          return NextResponse.json(
            { ok: false, error: updateAssetError.message },
            { status: 500 }
          );
        }
      } else {
        const { error: insertAssetError } = await supabaseAdmin
          .from("audio_assets")
          .insert({
            conversation_id: savedConversation.id,
            slug: songRow.slug,
            title: songRow.title,
            storage_path: audioPath,
            version_label: "Final",
            is_final_version: true,
            is_playlistable: true,
            linked_song_id: songRow.id
          });

        if (insertAssetError) {
          return NextResponse.json(
            { ok: false, error: insertAssetError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      app: appRow,
      song: songRow,
      conversation: conversationRow
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
