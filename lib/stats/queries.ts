import { supabaseAdmin } from "@/lib/supabase-admin";
import { getKiikuWallet } from "@/lib/kiiku/ledger";

function since(range: string) {
  if (range === "all") return null;
  const d = new Date();
  if (range === "today") d.setHours(0,0,0,0);
  else if (range === "7d") d.setDate(d.getDate() - 7);
  else d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export async function getStats(userId: string, range: string) {
  const from = since(range);
  const q = (table: string) => {
    let builder = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    if (from) builder = builder.gte("created_at", from);
    return builder;
  };
  const wallet = await getKiikuWallet(userId);
  const [myPlays, myShares, myQualified, globalPlays, globalShares, claims, contributions] = await Promise.all([
    (from ? supabaseAdmin.from("playback_sessions").select("id", { count:"exact", head:true }).eq("user_id", userId).gte("created_at", from) : supabaseAdmin.from("playback_sessions").select("id", { count:"exact", head:true }).eq("user_id", userId)),
    (from ? supabaseAdmin.from("nearby_share_sessions").select("id", { count:"exact", head:true }).eq("sender_user_id", userId).gte("created_at", from) : supabaseAdmin.from("nearby_share_sessions").select("id", { count:"exact", head:true }).eq("sender_user_id", userId)),
    (from ? supabaseAdmin.from("share_qualifications").select("id", { count:"exact", head:true }).eq("sender_user_id", userId).gte("created_at", from) : supabaseAdmin.from("share_qualifications").select("id", { count:"exact", head:true }).eq("sender_user_id", userId)),
    q("playback_sessions"), q("nearby_share_sessions"), q("guest_account_claims"), q("project_contributions")
  ]);
  return {
    my: { songs_played: myPlays.count || 0, shares_started: myShares.count || 0, qualified_shares: myQualified.count || 0, kiiku_available: wallet.available, kiiku_pending: wallet.pending },
    global: { songs_played: globalPlays.count || 0, nearby_shares: globalShares.count || 0, new_accounts_from_sharing: claims.count || 0, project_contributions: contributions.count || 0, kiiku_earned: wallet.lifetimeEarned }
  };
}
