import { supabaseAdmin } from "@/lib/supabase-admin";

type MaybeRow = Record<string, any> | null | undefined;

export type ShareSongRow = {
  id: string;
  slug: string;
  title: string;
  artist_name?: string | null;
  project_id?: string | null;
  app_id?: string | null;
  source_app_slug?: string | null;
  is_shareable?: boolean | null;
  is_locked?: boolean | null;
  is_free_full_play?: boolean | null;
  requires_project_access?: boolean | null;
  requires_all_access?: boolean | null;
  release_at?: string | null;
  status?: string | null;
};

export type ShareProjectRow = {
  id: string;
  slug: string;
  name?: string | null;
  title?: string | null;
  status?: string | null;
};

export type UserShareAccess = {
  passAccess: boolean;
  projectIds: Set<string>;
  projectSlugs: Set<string>;
  songIds: Set<string>;
  allowanceRows: any[];
};

export function titleForProject(project?: MaybeRow) {
  const slug = String(project?.slug || "").toLowerCase();
  if (project?.name) return String(project.name);
  if (project?.title) return String(project.title);
  if (slug === "friends") return "Fri.ends";
  if (slug === "fartherhood" || slug === "fatherhood") return "FarTHErHOOD";
  if (slug === "milia") return "Milia";
  if (slug === "music") return "Music";
  if (!slug) return "Caliphornia OS";
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function active(row: MaybeRow) {
  if (!row) return false;
  const status = String(row.status || "active").toLowerCase();
  if (["revoked", "refunded", "disputed", "canceled", "expired", "reversed", "fraud_review", "removed"].includes(status)) {
    return false;
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return true;
}

export function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export async function loadUserShareAccess(user: { id: string; email: string }): Promise<UserShareAccess> {
  const email = normalize(user.email);

  const [passesRes, projectAccessRes, songAccessRes, allowancesRes] = await Promise.all([
    supabaseAdmin
      .from("user_access_passes")
      .select("id,access_key,status,expires_at,can_share")
      .or(`user_id.eq.${user.id},user_email.eq.${email}`),

    supabaseAdmin
      .from("user_project_access")
      .select("id,project_id,project_slug,status,expires_at,can_share")
      .or(`user_id.eq.${user.id},user_email.eq.${email}`),

    supabaseAdmin
      .from("user_song_access")
      .select("id,song_id,status,expires_at,can_share")
      .or(`user_id.eq.${user.id},user_email.eq.${email}`),

    supabaseAdmin
      .from("sharing_allowances")
      .select("*")
      .or(`user_id.eq.${user.id},user_email_snapshot.eq.${email}`)
      .in("status", ["active", "reserved"]),
  ]);

  const passAccess = (passesRes.data || []).some((row: any) => {
    if (!active(row)) return false;
    const key = normalize(row.access_key);
    return ["all_access", "music_full", "founder", "subscription", "kiiku_pass"].includes(key);
  });

  const projectIds = new Set<string>();
  const projectSlugs = new Set<string>();
  for (const row of projectAccessRes.data || []) {
    if (!active(row)) continue;
    if (row.project_id) projectIds.add(String(row.project_id));
    if (row.project_slug) projectSlugs.add(normalize(row.project_slug));
  }

  const songIds = new Set<string>();
  for (const row of songAccessRes.data || []) {
    if (!active(row)) continue;
    if (row.song_id) songIds.add(String(row.song_id));
  }

  return {
    passAccess,
    projectIds,
    projectSlugs,
    songIds,
    allowanceRows: allowancesRes.data || [],
  };
}

export function hasProjectAccess(project: MaybeRow, access: UserShareAccess) {
  if (!project) return false;
  return Boolean(
    access.passAccess ||
      access.projectIds.has(String(project.id || "")) ||
      access.projectSlugs.has(normalize(project.slug))
  );
}

export function isSongGloballyPlayable(song: ShareSongRow) {
  if (song.is_free_full_play) return true;
  if (song.release_at && new Date(song.release_at).getTime() <= Date.now() && !song.is_locked) return true;
  if (!song.is_locked && !song.requires_all_access && !song.requires_project_access) return true;
  return false;
}

export function hasSongAccess(song: ShareSongRow, project: MaybeRow, access: UserShareAccess) {
  if (access.passAccess) return true;
  if (access.songIds.has(String(song.id))) return true;
  if (project && hasProjectAccess(project, access)) return true;
  return isSongGloballyPlayable(song);
}

export function countShareCredits(access: UserShareAccess, song?: ShareSongRow | null, project?: MaybeRow) {
  const now = Date.now();
  return access.allowanceRows
    .filter((row) => active(row))
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .filter((row) => {
      const scope = String(row.scope || "").toLowerCase();
      if (scope === "universal") return true;
      if (song?.id && row.song_id === song.id) return true;
      if (project?.id && row.project_id === project.id) return true;
      return false;
    })
    .reduce((total, row) => {
      const remaining = Number(row.remaining_count ?? row.total_allowed ?? 0);
      const reserved = Number(row.reserved_count ?? 0);
      return total + Math.max(0, remaining - reserved);
    }, 0);
}

export async function findProject(identifier: { projectId?: string | null; projectSlug?: string | null }) {
  const projectId = identifier.projectId ? String(identifier.projectId) : "";
  const projectSlug = normalize(identifier.projectSlug);

  let query = supabaseAdmin.from("projects").select("id,slug,name,status").limit(1);
  query = projectId ? query.eq("id", projectId) : query.eq("slug", projectSlug);
  const result = await query.maybeSingle();
  return result.data as ShareProjectRow | null;
}

export async function loadProjectSongs(project: ShareProjectRow) {
  const primary = await supabaseAdmin
    .from("songs")
    .select("id,slug,title,artist_name,project_id,app_id,source_app_slug,is_shareable,is_locked,is_free_full_play,requires_project_access,requires_all_access,release_at,status,position")
    .eq("project_id", project.id)
    .neq("status", "archived")
    .order("position", { ascending: true });

  let songs = (primary.data || []) as ShareSongRow[];

  if (!songs.length && project.slug) {
    const fallback = await supabaseAdmin
      .from("songs")
      .select("id,slug,title,artist_name,project_id,app_id,source_app_slug,is_shareable,is_locked,is_free_full_play,requires_project_access,requires_all_access,release_at,status,position")
      .eq("source_app_slug", project.slug)
      .neq("status", "archived")
      .order("position", { ascending: true });
    songs = (fallback.data || []) as ShareSongRow[];
  }

  return songs.filter((song) => song.id && song.slug && song.is_shareable !== false);
}
