import type { CSSProperties } from "react";
import { getProjectProgress } from "@/lib/projects/progress";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function GlobalReleaseProgress({ projectSlug }: { projectSlug: string }) {
  const progress = await getProjectProgress(projectSlug);
  if (!progress?.goal) {
    return (
      <section className="glass card stack">
        <span className="eyebrow">Global Streaming Release</span>
        <h2 className="h2">Release goal coming soon.</h2>
        <p className="muted">Eligible support will appear here once this project goal is active.</p>
      </section>
    );
  }
  const g = progress.goal;
  const funded = g.status === "goal_reached" || g.status === "release_scheduled" || g.status === "globally_released" || Number(g.percentage) >= 100;
  return (
    <section className="glass card stack">
      <span className="eyebrow">Global Streaming Release</span>
      <h2 className="h2">{funded ? "Global release funded" : `${money(Number(g.current_eligible_contribution_cents), String(g.goal_currency || "USD"))} of ${money(Number(g.goal_amount_cents), String(g.goal_currency || "USD"))} funded`}</h2>
      <p className="muted">{funded ? "This project reached its configured support goal. A confirmed streaming date will appear when scheduled." : `${Number(g.percentage)}% complete · ${money(Number(g.remaining_amount_cents), String(g.goal_currency || "USD"))} remaining`}</p>
      <div className="progress" style={{ "--p": `${Number(g.percentage)}%` } as CSSProperties}><span /></div>
      <p className="small muted">{g.project_explanation || `Every eligible song or project purchase moves ${progress.project.name} closer to its global streaming release.`}</p>
      {progress.recent?.length ? <div className="stack">{progress.recent.slice(0,3).map((item: any, i: number) => <span className="badge" key={i}>A listener supported this project</span>)}</div> : null}
    </section>
  );
}
