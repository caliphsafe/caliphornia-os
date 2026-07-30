import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";
import { reserveAllowance } from "@/lib/sharing/allowances";
import { createPhrase, createTokenPair } from "@/lib/sharing/tokens";
import {
  findProject,
  hasProjectAccess,
  hasSongAccess,
  loadProjectSongs,
  loadUserShareAccess,
  normalize,
  titleForProject,
  type ShareProjectRow,
  type ShareSongRow,
} from "@/lib/share/share-access";

function roundedCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

function cleanLocation(input: any) {
  const lat = roundedCoord(input?.latitude ?? input?.lat);
  const lng = roundedCoord(input?.longitude ?? input?.lng);
  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    accuracy:
      Number.isFinite(Number(input?.accuracy)) && Number(input?.accuracy) > 0
        ? Math.round(Number(input.accuracy))
        : null,
    captured_at: new Date().toISOString(),
    precision: "rounded_4_decimal_places",
  };
}

async function findSong(body: any) {
  const songId = String(body.songId || "");
  const songSlug = normalize(body.songSlug);
  let query = supabaseAdmin
    .from("songs")
    .select("id,slug,title,artist_name,project_id,app_id,source_app_slug,is_shareable,is_locked,is_free_full_play,requires_project_access,requires_all_access,release_at,status")
    .limit(1);

  query = songId ? query.eq("id", songId) : query.eq("slug", songSlug);
  const result = await query.maybeSingle();
  return result.data as ShareSongRow | null;
}

async function projectForSong(song: ShareSongRow) {
  if (song.project_id) {
    const result = await supabaseAdmin
      .from("projects")
      .select("id,slug,name,status")
      .eq("id", song.project_id)
      .maybeSingle();

    if (result.data) return result.data as ShareProjectRow;
  }

  if (song.source_app_slug) {
    const result = await supabaseAdmin
      .from("projects")
      .select("id,slug,name,status")
      .eq("slug", song.source_app_slug)
      .maybeSingle();

    if (result.data) return result.data as ShareProjectRow;
  }

  return null;
}

async function projectUnlockProductKey(project?: ShareProjectRow | null) {
  if (!project?.id) return null;

  const result = await supabaseAdmin
    .from("commerce_products")
    .select("product_key,product_type,project_id,status")
    .eq("project_id", project.id)
    .eq("status", "active")
    .in("product_type", ["project_unlock", "project", "album", "album_unlock"])
    .limit(1)
    .maybeSingle();

  return result.data?.product_key || null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const scope = normalize(body.shareScope || body.scope || "song") === "project" ? "project" : "song";
    const senderLocation = cleanLocation(body.location || body);
    const access = await loadUserShareAccess(user);

    if (!senderLocation) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Allow location to start a proximity Share. The receiver will only see it when they are near you.",
        },
        { status: 400 }
      );
    }

    let project: ShareProjectRow | null = null;
    let songs: ShareSongRow[] = [];
    let displayTitle = "Shared song";

    if (scope === "project") {
      project = await findProject({
        projectId: body.projectId ? String(body.projectId) : null,
        projectSlug: body.projectSlug ? String(body.projectSlug) : null,
      });

      if (!project?.id) {
        return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
      }

      if (!hasProjectAccess(project, access)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unlock ${titleForProject(project)} before sharing the full project.`,
            unlockProductKey: await projectUnlockProductKey(project),
          },
          { status: 403 }
        );
      }

      songs = (await loadProjectSongs(project)).filter((song) => hasSongAccess(song, project, access));
      displayTitle = `${titleForProject(project)} project share`;

      if (!songs.length) {
        return NextResponse.json(
          { ok: false, error: "This project has no shareable songs yet." },
          { status: 404 }
        );
      }
    } else {
      const song = await findSong(body);

      if (!song?.id) {
        return NextResponse.json({ ok: false, error: "Song not found." }, { status: 404 });
      }

      if (song.is_shareable === false) {
        return NextResponse.json({ ok: false, error: "This song is not shareable yet." }, { status: 403 });
      }

      project = await projectForSong(song);

      if (!hasSongAccess(song, project, access)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Unlock this song or project before sharing it.",
            unlockProductKey: await projectUnlockProductKey(project),
          },
          { status: 403 }
        );
      }

      songs = [song];
      displayTitle = song.title || song.slug;
    }

    const primarySong = songs[0];
    const { token, tokenHash } = createTokenPair();
    const phrase = createPhrase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    let allowanceId: string | null = null;

    try {
      const allowance = await reserveAllowance({
        userId: user.id,
        songId: primarySong.id,
        projectId: project?.id || primarySong.project_id || null,
        sessionId: "pending",
      });
      allowanceId = allowance?.id || null;
    } catch {
      allowanceId = null;
    }

    const inserted = await supabaseAdmin
      .from("nearby_share_sessions")
      .insert({
        sender_user_id: user.id,
        song_id: primarySong.id,
        project_id: project?.id || primarySong.project_id || null,
        app_id: primarySong.app_id || null,
        allowance_id: allowanceId,
        share_token_hash: tokenHash,
        fallback_phrase_hash: sha256(phrase),
        status: "searching",
        share_scope: scope,
        share_method_snapshot: "main_page_proximity",
        song_slug_snapshot: scope === "song" ? primarySong.slug : null,
        song_title_snapshot: scope === "song" ? primarySong.title : displayTitle,
        project_slug_snapshot: project?.slug || primarySong.source_app_slug || null,
        project_name_snapshot: project ? titleForProject(project) : null,
        sender_email_snapshot: user.email,
        expires_at: expiresAt,
        location_data_delete_at: expiresAt,
        metadata: {
          sender_label: user.username ? `${user.username}'s device` : "Caliphornia listener",
          sender_location: senderLocation,
          share_song_ids: songs.map((song) => song.id),
          share_song_slugs: songs.map((song) => song.slug),
          share_song_titles: songs.map((song) => song.title || song.slug),
          share_count: songs.length,
          receiver_flow: "main_page_proximity",
          receiver_instruction:
            "The receiver opens the Caliphornia OS main page near you. A Receive button appears automatically when their device is close.",
        },
      })
      .select("id")
      .single();

    if (inserted.error) throw new Error(inserted.error.message);

    if (allowanceId) {
      await supabaseAdmin
        .from("sharing_allowances")
        .update({ metadata: { reserved_for_share_session_id: inserted.data.id } })
        .eq("id", allowanceId);
    }

    await supabaseAdmin.from("nearby_share_events").insert({
      share_session_id: inserted.data.id,
      actor_user_id: user.id,
      event_type: scope === "project" ? "project_share_created" : "song_share_created",
      event_status: "ok",
      metadata: {
        song_count: songs.length,
        receiver_flow: "main_page_proximity",
      },
    });

    return NextResponse.json({
      ok: true,
      shareSessionId: inserted.data.id,
      shareToken: token,
      phrase,
      scope,
      title: displayTitle,
      songCount: songs.length,
      expiresAt,
      receiverMode: "main_page_proximity",
      receiverInstruction:
        "Keep this Share screen open. The receiver opens the Caliphornia OS main page near you, allows location, and taps the Receive button that appears.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not start Share." },
      { status: 500 }
    );
  }
}
