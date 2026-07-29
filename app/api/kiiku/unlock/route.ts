import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAppUser } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getKiikuWallet, createKiikuTransaction } from "@/lib/kiiku/ledger";
import { idempotencyKey } from "@/lib/crypto";
export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentAppUser();
    const body = await req.json();
    const ruleKey = String(body.ruleKey || "");
    const rule = await supabaseAdmin.from("kiiku_rules").select("*").eq("rule_key", ruleKey).eq("status", "active").maybeSingle();
    if (!rule.data) return NextResponse.json({ ok:false, error:"Unlock is not available." }, { status:404 });
    const cost = Number(rule.data.spend_cost || 0);
    const wallet = await getKiikuWallet(user.id);
    if (wallet.available < cost) return NextResponse.json({ ok:false, error:"Not enough Kiiku." }, { status:402 });
    const songId = body.songId || rule.data.metadata?.song_id || null;
    const projectId = body.projectId || rule.data.metadata?.project_id || null;
    const tx = await createKiikuTransaction({ userId:user.id, amount:cost, direction:"spend", transactionType:String(rule.data.action_type || "unlock"), reason:`Unlocked with Kiiku`, idempotencyKey:idempotencyKey(["kiiku_unlock_spend", user.id, rule.data.id, songId, projectId]), ruleId:rule.data.id, songId, projectId });
    let access: any = null;
    if (songId) {
      access = await supabaseAdmin.from("user_song_access").upsert({ user_id:user.id, user_email:user.email, song_id:songId, source_type:"kiiku", source_kiiku_transaction_id:tx.id, status:"active", idempotency_key:idempotencyKey(["kiiku_song_access", tx.id, songId]) }, { onConflict:"idempotency_key" }).select("*").single();
      await supabaseAdmin.from("kiiku_unlocks").upsert({ user_id:user.id, kiiku_transaction_id:tx.id, song_access_id:access.data?.id || null, song_id:songId, unlock_type:"song", status:"active", idempotency_key:idempotencyKey(["kiiku_unlock", tx.id]) }, { onConflict:"idempotency_key" });
    }
    if (projectId) {
      access = await supabaseAdmin.from("user_project_access").upsert({ user_id:user.id, user_email:user.email, project_id:projectId, source_type:"kiiku", source_kiiku_transaction_id:tx.id, status:"active", idempotency_key:idempotencyKey(["kiiku_project_access", tx.id, projectId]) }, { onConflict:"idempotency_key" }).select("*").single();
      await supabaseAdmin.from("kiiku_unlocks").upsert({ user_id:user.id, kiiku_transaction_id:tx.id, project_access_id:access.data?.id || null, project_id:projectId, unlock_type:"project", status:"active", idempotency_key:idempotencyKey(["kiiku_unlock", tx.id]) }, { onConflict:"idempotency_key" });
    }
    return NextResponse.json({ ok:true, transaction:tx });
  } catch { return NextResponse.json({ ok:false, error:"Could not unlock with Kiiku." }, { status:500 }); }
}
