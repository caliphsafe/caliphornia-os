export type ShareTarget = {
  songId?: string | null;
  songSlug?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  scope?: "song" | "project";
};

export function buildShareHref(target: ShareTarget) {
  const params = new URLSearchParams();
  params.set("mode", "send");
  params.set("scope", target.scope === "project" ? "project" : "song");

  if (target.songId) params.set("songId", String(target.songId));
  if (target.songSlug) params.set("songSlug", String(target.songSlug));
  if (target.projectId) params.set("projectId", String(target.projectId));
  if (target.projectSlug) {
    params.set("projectSlug", String(target.projectSlug));
  }

  return `/apps/share?${params.toString()}`;
}
