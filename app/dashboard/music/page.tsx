import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminMusicClient from "@/components/admin/AdminMusicClient";
import "../admin.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function safe<T>(promise: PromiseLike<{ data: T[] | null; error: any }>) {
  try {
    const result = await promise;
    return result.error ? [] : result.data || [];
  } catch {
    return [];
  }
}

export default async function AdminMusicPage() {
  await requireAdminUser();
  const [songs, projects, apps] = await Promise.all([
    safe<any>(supabaseAdmin.from("songs").select("id,slug,title,artist_name,source_app_slug,project_id,status,is_shareable,is_locked,requires_project_access,audio_path,preview_audio_path,position").order("position", { ascending: true }).limit(500)),
    safe<any>(supabaseAdmin.from("projects").select("id,slug,name,title,status").order("name", { ascending: true })),
    safe<any>(supabaseAdmin.from("apps").select("id,slug,name,title,status").order("name", { ascending: true })),
  ]);
  return <AdminMusicClient songs={songs} projects={projects} apps={apps} />;
}
