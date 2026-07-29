import { supabaseAdmin } from "@/lib/supabase-admin";

export async function reserveAllowance(input: { userId: string; songId: string; projectId?: string | null; sessionId: string }) {
  const { data, error } = await supabaseAdmin
    .from("sharing_allowances")
    .select("*")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .or(`scope.eq.universal,song_id.eq.${input.songId}${input.projectId ? `,project_id.eq.${input.projectId}` : ""}`)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const remaining = Number(data.remaining_count ?? data.total_allowed ?? 0);
  if (remaining <= 0) return null;
  const updated = await supabaseAdmin
    .from("sharing_allowances")
    .update({ reserved_count: Number(data.reserved_count || 0) + 1, metadata: { ...(data.metadata || {}), last_reserved_for: input.sessionId } })
    .eq("id", data.id)
    .select("*")
    .single();
  if (updated.error) throw new Error(updated.error.message);
  return updated.data;
}

export async function consumeAllowance(allowanceId: string) {
  const current = await supabaseAdmin.from("sharing_allowances").select("*").eq("id", allowanceId).maybeSingle();
  if (!current.data) return null;
  const used = Number(current.data.used_count || 0) + 1;
  const total = Number(current.data.total_allowed || 0);
  const remaining = Math.max(0, total - used);
  const { data, error } = await supabaseAdmin
    .from("sharing_allowances")
    .update({ used_count: used, remaining_count: remaining, reserved_count: Math.max(0, Number(current.data.reserved_count || 0) - 1), status: remaining <= 0 ? "exhausted" : "active" })
    .eq("id", allowanceId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function releaseAllowance(allowanceId?: string | null) {
  if (!allowanceId) return;
  const current = await supabaseAdmin.from("sharing_allowances").select("reserved_count").eq("id", allowanceId).maybeSingle();
  if (!current.data) return;
  await supabaseAdmin.from("sharing_allowances").update({ reserved_count: Math.max(0, Number(current.data.reserved_count || 0) - 1) }).eq("id", allowanceId);
}
