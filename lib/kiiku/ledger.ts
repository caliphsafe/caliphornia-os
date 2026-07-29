import { supabaseAdmin } from "@/lib/supabase-admin";

export async function createKiikuTransaction(input: {
  userId: string;
  amount: number;
  direction: "earn" | "spend" | "adjustment" | "reversal";
  transactionType: string;
  status?: "pending" | "approved" | "reversed" | "expired" | "rejected" | "fraud_review";
  reason: string;
  idempotencyKey: string;
  ruleId?: string | null;
  campaignId?: string | null;
  purchaseId?: string | null;
  shareSessionId?: string | null;
  projectId?: string | null;
  songId?: string | null;
  appId?: string | null;
  reversalOfTransactionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const row = {
    user_id: input.userId,
    amount: input.amount,
    direction: input.direction,
    transaction_type: input.transactionType,
    status: input.status || "approved",
    reason: input.reason,
    idempotency_key: input.idempotencyKey,
    rule_id: input.ruleId || null,
    campaign_id: input.campaignId || null,
    purchase_id: input.purchaseId || null,
    share_session_id: input.shareSessionId || null,
    project_id: input.projectId || null,
    song_id: input.songId || null,
    app_id: input.appId || null,
    reversal_of_transaction_id: input.reversalOfTransactionId || null,
    approved_at: (input.status || "approved") === "approved" ? new Date().toISOString() : null,
    metadata: input.metadata || {}
  };

  const { data, error } = await supabaseAdmin
    .from("kiiku_transactions")
    .upsert(row, { onConflict: "idempotency_key" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getKiikuWallet(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("kiiku_transactions")
    .select("amount,direction,status,transaction_type,reason,created_at,expires_at,metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data || [];
  const approved = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status === "pending");
  const credit = approved.filter((r) => ["earn", "adjustment"].includes(r.direction)).reduce((s, r) => s + Number(r.amount), 0);
  const debit = approved.filter((r) => ["spend", "reversal"].includes(r.direction)).reduce((s, r) => s + Number(r.amount), 0);
  return {
    available: Math.max(0, credit - debit),
    pending: pending.reduce((s, r) => s + Number(r.amount), 0),
    lifetimeEarned: approved.filter((r) => r.direction === "earn").reduce((s, r) => s + Number(r.amount), 0),
    lifetimeSpent: approved.filter((r) => r.direction === "spend").reduce((s, r) => s + Number(r.amount), 0),
    recent: rows.slice(0, 20)
  };
}
