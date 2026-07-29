import { supabaseAdmin } from "@/lib/supabase-admin";

export async function auditAction(input: {
  adminUserId?: string | null;
  actionType: string;
  targetTable?: string | null;
  targetId?: string | null;
  reason?: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("admin_audit_logs").insert({
    admin_user_id: input.adminUserId || null,
    action_type: input.actionType,
    target_table: input.targetTable || null,
    target_id: input.targetId || null,
    reason: input.reason || null,
    before_snapshot: input.beforeSnapshot || null,
    after_snapshot: input.afterSnapshot || null,
    metadata: input.metadata || {}
  });
}
