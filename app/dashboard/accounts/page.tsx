import { requireAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import AdminAccountsClient from "@/components/admin/AdminAccountsClient";
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

export default async function AdminAccountsPage() {
  const admin = await requireAdminUser();
  const [users, projects, songs, apps] = await Promise.all([
    safe<any>(supabaseAdmin.from("app_users").select("id,email,username,role,status,created_at").order("created_at", { ascending: false }).limit(200)),
    safe<any>(supabaseAdmin.from("projects").select("id,slug,name,title,status").order("name", { ascending: true })),
    safe<any>(supabaseAdmin.from("songs").select("id,slug,title,artist_name,status,project_id,source_app_slug").order("title", { ascending: true }).limit(500)),
    safe<any>(supabaseAdmin.from("apps").select("id,slug,name,title,status").order("name", { ascending: true })),
  ]);

  return <AdminAccountsClient adminEmail={admin.email} users={users} projects={projects} songs={songs} apps={apps} />;
}
