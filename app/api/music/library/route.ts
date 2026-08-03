import { NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveEffectiveAccess } from "@/lib/access/effective-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UnknownRow = Record<string, any>;

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function statusIsVisible(value: unknown) {
  const status = String(value || "").toLowerCase();
  return !["archived", "deleted", "removed"].includes(status);
}

/*
 * Cover art is returned through a stable same-origin binary endpoint.
 * The browser never stores a temporary Supabase signed URL.
 */
function coverUrl(row: UnknownRow) {
  const directUrl = text(
    row.cover_url,
    row.coverUrl,
    row.artwork_url,
    row.image_url,
  );

  if (
    directUrl.startsWith("http://") ||
    directUrl.startsWith("https://")
  ) {
    return directUrl;
  }

  const rawPath = text(
    row.cover_image_path,
    row.cover_path,
    row.artwork_path,
    row.image_path,
  );

  if (!rawPath) return null;

  const songId = text(row.id);
  const songSlug = text(row.slug, row.song_slug);
  const params = new URLSearchParams({ v: "3" });

  if (songId) params.set("songId", songId);
  if (songSlug) params.set("songSlug", songSlug);

  return `/api/media/cover?${params.toString()}`;
}

function projectTitle(
  project: UnknownRow | null,
  song: UnknownRow,
) {
  return (
    text(
      project?.name,
      project?.title,
      song.project_name,
      song.album_name,
      song.source_app_slug,
    ) || "Caliphornia OS"
  );
}

export async function GET() {
  try {
    const user = await requireCurrentAppUser();

    const songsResult = await supabaseAdmin
      .from("songs")
      .select("*");

    if (songsResult.error) {
      throw new Error(songsResult.error.message);
    }

    const rawSongs = (songsResult.data || []).filter(
      (song: UnknownRow) =>
        Boolean(text(song.id)) &&
        Boolean(text(song.slug, song.song_slug)) &&
        statusIsVisible(song.status),
    );

    const [favoritesResult, projectsResult] =
      await Promise.all([
        supabaseAdmin
          .from("user_favorite_songs")
          .select("*")
          .or(
            `user_id.eq.${user.id},user_email.eq.${user.email}`,
          )
          .then(
            (result) => result,
            () => ({ data: [], error: null }),
          ),
        supabaseAdmin
          .from("projects")
          .select("*")
          .then(
            (result) => result,
            () => ({ data: [], error: null }),
          ),
      ]);

    const favoriteRows = (
      favoritesResult.data || []
    ).filter((row: UnknownRow) =>
      statusIsVisible(row.status),
    );

    const projects = (projectsResult.data || []).filter(
      (row: UnknownRow) => statusIsVisible(row.status),
    );

    const favoriteById = new Map(
      favoriteRows
        .filter((row: UnknownRow) => text(row.song_id))
        .map((row: UnknownRow) => [
          text(row.song_id),
          row,
        ]),
    );

    const favoriteBySlug = new Map(
      favoriteRows
        .filter((row: UnknownRow) => text(row.song_slug))
        .map((row: UnknownRow) => [
          text(row.song_slug),
          row,
        ]),
    );

    const projectById = new Map(
      projects
        .filter((row: UnknownRow) => text(row.id))
        .map((row: UnknownRow) => [text(row.id), row]),
    );

    const projectBySlug = new Map(
      projects
        .filter((row: UnknownRow) => text(row.slug))
        .map((row: UnknownRow) => [
          text(row.slug),
          row,
        ]),
    );

    const songs = await Promise.all(
      rawSongs.map(async (song: UnknownRow) => {
        const id = text(song.id);
        const slug = text(song.slug, song.song_slug);
        const project =
          projectById.get(text(song.project_id)) ||
          projectBySlug.get(
            text(song.source_app_slug, song.project_slug),
          ) ||
          null;

        const favorite =
          favoriteById.get(id) ||
          favoriteBySlug.get(slug) ||
          null;

        const access = await resolveEffectiveAccess({
          userId: user.id,
          userEmail: user.email,
          songId: id,
          songSlug: slug,
          requestedAction: "play",
        }).catch(() => null);

        const appSlug = text(
          song.source_app_slug,
          song.app_slug,
          project?.slug,
          "music",
        );

        return {
          id,
          slug,
          title:
            text(song.title, song.name, slug) || "Song",
          artist:
            text(
              song.artist_name,
              song.artist,
              song.artist_display_name,
            ) || "Caliph",
          projectName: projectTitle(project, song),
          projectSlug:
            text(project?.slug, song.project_slug, appSlug) ||
            "music",
          appSlug,
          coverUrl: coverUrl(song),
          durationLabel: text(
            song.duration_label,
            song.duration,
            song.length_label,
          ),
          accessLabel:
            text(access?.displayLabel) ||
            (access?.playbackMode === "preview"
              ? "Preview"
              : "Available"),
          canPlay: access
            ? access.playbackMode !== "blocked"
            : true,
          isPreview: access
            ? access.playbackMode === "preview"
            : false,
          isFavorite: Boolean(favorite),
          favoriteId: text(favorite?.id) || null,
          favoriteOrder: Number.isFinite(
            Number(favorite?.favorite_order),
          )
            ? Number(favorite.favorite_order)
            : null,
          shareable:
            song.is_shareable !== false &&
            song.shareable !== false &&
            Boolean(
              access?.sharingEligible ||
                access?.allowed ||
                favorite ||
                song.is_free_full_play,
            ),
          sharesRemaining: Number(
            access?.sharesRemaining || 0,
          ),
          sortOrder: Number.isFinite(Number(song.position))
            ? Number(song.position)
            : Number.isFinite(Number(song.track_number))
              ? Number(song.track_number)
              : 999999,
          createdAt: text(song.created_at),
        };
      }),
    );

    songs.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      if (a.createdAt && b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }

      return a.title.localeCompare(b.title);
    });

    const favorites = songs
      .filter((song) => song.isFavorite)
      .sort((a, b) => {
        const aOrder = a.favoriteOrder ?? 999999;
        const bOrder = b.favoriteOrder ?? 999999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
      });

    const projectCounts = new Map<
      string,
      { slug: string; name: string; count: number }
    >();

    for (const song of songs) {
      const key =
        song.projectSlug || song.appSlug || "music";
      const current = projectCounts.get(key) || {
        slug: key,
        name: song.projectName || key,
        count: 0,
      };

      current.count += 1;
      projectCounts.set(key, current);
    }

    return NextResponse.json(
      {
        ok: true,
        songs,
        favorites,
        projects: Array.from(
          projectCounts.values(),
        ).sort((a, b) => a.name.localeCompare(b.name)),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load Music library.",
        songs: [],
        favorites: [],
        projects: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
