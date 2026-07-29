import GlobalReleaseProgress from "@/components/projects/GlobalReleaseProgress";
import ProjectSongs from "@/components/projects/ProjectSongs";

export default function Page() {
  return (
    <main className="shell stack">
      <header className="topbar"><div><span className="eyebrow">Project</span><h1 className="h1">Milia</h1></div><a className="btn" href="/home">Home</a></header>
      <GlobalReleaseProgress projectSlug="milia" />
      <ProjectSongs projectSlug="milia" />
    </main>
  );
}
