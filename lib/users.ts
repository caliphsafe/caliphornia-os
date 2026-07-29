import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/crypto";
import { readSession } from "@/lib/session";
import type { AppUser } from "@/types/domain";

export async function getOrCreateAppUser(email: string, username?: string | null): Promise<AppUser> {
  const normalized = normalizeEmail(email);
  const existing = await supabaseAdmin
    .from("app_users")
    .select("id,email,username,role")
    .eq("email", normalized)
    .maybeSingle();

  if (existing.data?.id) return existing.data as AppUser;

  const inserted = await supabaseAdmin
    .from("app_users")
    .insert({ email: normalized, username: username || normalized.split("@")[0], status: "active" })
    .select("id,email,username,role")
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data as AppUser;
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const session = await readSession();
  if (!session?.email) return null;
  const { data } = await supabaseAdmin
    .from("app_users")
    .select("id,email,username,role")
    .eq("email", normalizeEmail(session.email))
    .maybeSingle();
  return (data as AppUser | null) || null;
}

export async function requireCurrentAppUser(): Promise<AppUser> {
  const user = await getCurrentAppUser();
  if (!user?.id) throw new Error("AUTH_REQUIRED");
  return user;
}
