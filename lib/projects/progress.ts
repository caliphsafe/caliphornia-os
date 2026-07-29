import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getProjectProgress(projectSlug: string) {
  const project = await supabaseAdmin.from("projects").select("id,slug,name,description,status").eq("slug", projectSlug).maybeSingle();
  if (!project.data?.id) return null;
  const goal = await supabaseAdmin
    .from("project_release_goals")
    .select("*")
    .eq("project_id", project.data.id)
    .in("status", ["active", "goal_reached", "release_scheduled", "globally_released"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!goal.data) return { project: project.data, goal: null, recent: [] };
  const contributions = await supabaseAdmin
    .from("project_contributions")
    .select("eligible_amount_cents,status,created_at,contribution_type,song_id,metadata")
    .eq("goal_id", goal.data.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const confirmed = await supabaseAdmin
    .from("project_contributions")
    .select("eligible_amount_cents,status")
    .eq("goal_id", goal.data.id)
    .eq("status", "confirmed");
  const total = (confirmed.data || []).reduce((sum, row) => sum + Number(row.eligible_amount_cents || 0), 0);
  const goalAmount = Number(goal.data.goal_amount_cents || 0);
  return {
    project: project.data,
    goal: {
      ...goal.data,
      current_eligible_contribution_cents: total,
      remaining_amount_cents: Math.max(0, goalAmount - total),
      percentage: goalAmount > 0 ? Math.min(100, Math.round((total / goalAmount) * 100)) : 0
    },
    recent: contributions.data || []
  };
}
