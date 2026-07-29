import { supabaseAdmin } from "@/lib/supabase-admin";
import PlayButton from "@/components/music/PlayButton";

export default async function ProjectSongs({ projectSlug }: { projectSlug: string }) {
  const project = await supabaseAdmin.from("projects").select("id,slug,name").eq("slug", projectSlug).maybeSingle();
  const songs = project.data?.id
    ? await supabaseAdmin.from("songs").select("id,slug,title,artist,cover_path,project_id").eq("project_id", project.data.id).order("position", { ascending: true })
    : await supabaseAdmin.from("songs").select("id,slug,title,artist,cover_path,source_app_slug").eq("source_app_slug", projectSlug).order("position", { ascending: true });
  const rows = songs.data || [];
  return (
    <section className="glass card stack">
      <span className="eyebrow">Songs</span>
      {rows.length ? <div className="grid">{rows.map((song: any) => <div className="kpi" key={song.id}><strong>{song.title}</strong><p className="small muted">{song.artist || "Caliph"}</p><PlayButton songId={song.id} songSlug={song.slug} title={song.title} artist={song.artist} /></div>)}</div> : <p className="muted">No published songs are connected yet.</p>}
    </section>
  );
}
