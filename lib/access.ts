import { supabaseAdmin } from "@/lib/supabase-admin";

export type AccessCheckResult = {
  hasAllAccess: boolean;
  hasMusicFull: boolean;
  isFounder: boolean;
  projectAccess: string[];
};

export async function getUserAccess(userEmail: string): Promise<AccessCheckResult> {
  const email = userEmail.trim().toLowerCase();

  const [passesRes, projectsRes] = await Promise.all([
    supabaseAdmin
      .from("user_access_passes")
      .select("access_key, expires_at")
      .eq("user_email", email),

    supabaseAdmin
      .from("user_project_access")
      .select("project_slug, expires_at")
      .eq("user_email", email),
  ]);

  const now = Date.now();

  const activePasses = (passesRes.data || [])
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => row.access_key);

  const activeProjects = (projectsRes.data || [])
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => row.project_slug);

  const hasAllAccess = activePasses.includes("all_access");
  const hasMusicFull = hasAllAccess || activePasses.includes("music_full");
  const isFounder = activePasses.includes("founder");

  return {
    hasAllAccess,
    hasMusicFull,
    isFounder,
    projectAccess: activeProjects,
  };
}

export async function userCanAccessProject(userEmail: string, projectSlug: string) {
  const access = await getUserAccess(userEmail);

  if (access.hasAllAccess || access.isFounder) return true;
  return access.projectAccess.includes(projectSlug);
}

export async function userCanAccessMusicFull(userEmail: string) {
  const access = await getUserAccess(userEmail);
  return access.hasAllAccess || access.hasMusicFull || access.isFounder;
}

export async function userCanAccessSong({
  userEmail,
  projectSlug,
  song,
}: {
  userEmail: string;
  projectSlug?: string | null;
  song: {
    release_at?: string | null;
    early_access_at?: string | null;
    is_locked?: boolean | null;
    requires_project_access?: boolean | null;
    requires_all_access?: boolean | null;
  };
}) {
  const access = await getUserAccess(userEmail);
  const now = Date.now();

  if (access.hasAllAccess || access.isFounder) {
    return true;
  }

  if (song.requires_all_access) {
    return false;
  }

  const hasProjectAccess =
    Boolean(projectSlug) && access.projectAccess.includes(projectSlug as string);

  if (song.requires_project_access && !hasProjectAccess) {
    return false;
  }

  const releaseAt = song.release_at ? new Date(song.release_at).getTime() : null;
  const earlyAccessAt = song.early_access_at
    ? new Date(song.early_access_at).getTime()
    : null;

  if (releaseAt && now >= releaseAt) {
    return true;
  }

  if (earlyAccessAt && now >= earlyAccessAt && hasProjectAccess) {
    return true;
  }

  if (song.is_locked) {
    return false;
  }

  return true;
}

export async function getSongPlaybackAccess({
  userEmail,
  projectSlug,
  song,
}: {
  userEmail: string;
  projectSlug?: string | null;
  song: {
  slug?: string | null;
  audio_path?: string | null;
  preview_audio_path?: string | null;
  preview_starts_at?: number | null;
  preview_duration?: number | null;
  release_at?: string | null;
  early_access_at?: string | null;
  is_locked?: boolean | null;
  requires_project_access?: boolean | null;
  requires_all_access?: boolean | null;
  is_free_full_play?: boolean | null;
};
}) {
  if (song.is_free_full_play) {
  return {
    canPlayFull: true,
    isPreview: false,
    playbackPath: song.audio_path || null,
    clipStartSeconds: null,
    clipEndSeconds: null,
    lockedReason: null,
  };
}

const canPlayFull = await userCanAccessSong({
  userEmail,
  projectSlug,
  song,
});

  if (canPlayFull) {
    return {
      canPlayFull: true,
      isPreview: false,
      playbackPath: song.audio_path || null,
      clipStartSeconds: null,
      clipEndSeconds: null,
      lockedReason: null,
    };
  }

  const previewStart = song.preview_starts_at ?? 0;
  const previewDuration = song.preview_duration ?? 30;

  return {
    canPlayFull: false,
    isPreview: true,
    playbackPath: song.preview_audio_path || song.audio_path || null,
    clipStartSeconds: previewStart,
    clipEndSeconds: previewStart + previewDuration,
    lockedReason: "Unlock this project to hear the full song.",
  };
}
