"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ShareSong = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  owned: boolean;
  shareable: boolean;
  shareCredits: number;
  accessLabel: string;
};

type ShareProject = {
  id: string;
  slug: string;
  name: string;
  owned: boolean;
  shareable: boolean;
  songCount: number;
  shareableSongCount: number;
  shareCredits: number;
  unlockProductKey?: string | null;
  unlockPrice?: string | null;
  songs: ShareSong[];
};

type Candidate = {
  id: string;
  scope: "song" | "project";
  title: string;
  song_title: string;
  sender_label: string;
  songCount: number;
  summary: string;
};

type ShareStats = {
  songsPlayed?: number;
  nearbyShares?: number;
  qualifiedShares?: number;
  accountsCreated?: number;
};

function statusCopy(step: string) {
  if (step === "idle") return "Choose a song or full project, then keep this screen open while the receiver taps Receive.";
  if (step === "searching") return "Finding a listening handoff. Stay close and keep Share open.";
  if (step === "sending") return "Share is live. The receiver should open Caliphornia OS, go to Share, tap Receive, then accept your transfer.";
  if (step === "received") return "Transfer accepted. The guest listening link is ready.";
  return "Share is ready.";
}

function plural(value: number, singular: string, pluralText: string) {
  return value === 1 ? singular : pluralText;
}

export default function ShareClient() {
  const [projects, setProjects] = useState<ShareProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSongSlug, setSelectedSongSlug] = useState("");
  const [shareScope, setShareScope] = useState<"song" | "project">("song");
  const [shareSessionId, setShareSessionId] = useState("");
  const [phrase, setPhrase] = useState("");
  const [receiveUrl, setReceiveUrl] = useState("");
  const [guestToken, setGuestToken] = useState("");
  const [guestSessionId, setGuestSessionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [guestUrl, setGuestUrl] = useState("");
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [step, setStep] = useState("idle");
  const [error, setError] = useState("");
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [stats, setStats] = useState<ShareStats>({});
  const pollRef = useRef<number | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  );

  const shareableSongs = selectedProject?.songs.filter((song) => song.shareable) || [];
  const selectedSong = useMemo(
    () => shareableSongs.find((song) => song.slug === selectedSongSlug) || shareableSongs[0] || null,
    [shareableSongs, selectedSongSlug]
  );

  const selectedTitle =
    shareScope === "project"
      ? selectedProject?.name || "Project"
      : selectedSong?.title || "Song";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "receive") {
      setMode("receive");
      void startReceive();
    }

    let active = true;
    async function load() {
      setLoadingLibrary(true);
      try {
        const [libraryRes, statsRes] = await Promise.all([
          fetch("/api/share/library", { cache: "no-store" }),
          fetch("/api/apps/stats?range=30d", { cache: "no-store" }).catch(() => null),
        ]);

        const libraryData = await libraryRes.json();
        if (active && Array.isArray(libraryData?.projects)) {
          setProjects(libraryData.projects);
          const firstShareableProject =
            libraryData.projects.find((project: ShareProject) => project.shareable) || libraryData.projects[0];
          if (firstShareableProject?.id) {
            setSelectedProjectId(firstShareableProject.id);
            const firstSong = firstShareableProject.songs?.find((song: ShareSong) => song.shareable);
            if (firstSong?.slug) setSelectedSongSlug(firstSong.slug);
          }
        }

        if (statsRes) {
          const statsData = await statsRes.json().catch(() => null);
          const my = statsData?.stats?.my || {};
          const global = statsData?.stats?.global || {};
          if (active) {
            setStats({
              songsPlayed: Number(my.songs_played || 0),
              nearbyShares: Number(global.nearby_shares || 0),
              qualifiedShares: Number(my.qualified_shares || 0),
              accountsCreated: Number(global.new_accounts_from_sharing || 0),
            });
          }
        }
      } catch (err) {
        if (active) setError("Could not load your Share library yet.");
      } finally {
        if (active) setLoadingLibrary(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function selectProject(project: ShareProject) {
    setSelectedProjectId(project.id);
    const firstSong = project.songs.find((song) => song.shareable);
    setSelectedSongSlug(firstSong?.slug || "");
    if (!project.shareable && shareScope === "project") setShareScope("song");
  }

  async function startShare() {
    setError("");
    setGuestUrl("");

    if (!selectedProject) {
      setError("Choose a project first.");
      return;
    }

    if (shareScope === "song" && !selectedSong) {
      setError("Choose a shareable song first.");
      return;
    }

    if (shareScope === "project" && !selectedProject.shareable) {
      setError(`Unlock ${selectedProject.name} before sharing the full project.`);
      return;
    }

    setStep("searching");

    try {
      const res = await fetch("/api/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareScope,
          projectId: selectedProject.id,
          projectSlug: selectedProject.slug,
          songSlug: selectedSong?.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not start Share.");
      setShareSessionId(data.shareSessionId || "");
      setPhrase(data.phrase || "");
      setReceiveUrl(data.receiveUrl || "/apps/share?mode=receive");
      setStep("sending");
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "Could not start Share.");
    }
  }

  async function startReceive() {
    setMode("receive");
    setError("");
    setGuestUrl("");
    setStep("searching");

    try {
      const res = await fetch("/api/nearby/receive/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceLabel: "Caliphornia listener" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not start receiver.");
      setGuestToken(data.guestToken || "");
      setGuestSessionId(data.guestSessionId || "");
      await pollCandidates(data.guestToken);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => pollCandidates(data.guestToken), 3000);
    } catch (err) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "Could not start receiver.");
    }
  }

  async function pollCandidates(token = guestToken) {
    if (!token) return;
    try {
      const res = await fetch(`/api/nearby/receive/candidates?guestToken=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.candidates)) setCandidates(data.candidates);
    } catch {}
  }

  async function acceptCandidate(candidate: Candidate) {
    setError("");
    try {
      const res = await fetch("/api/nearby/receive/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken, shareSessionId: candidate.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Could not accept Share.");
      setGuestUrl(data.guestUrl || "");
      setStep("received");
      if (pollRef.current) window.clearInterval(pollRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept Share.");
    }
  }

  async function startCheckout(productKey?: string | null) {
    if (!productKey) {
      setError("This project needs an active commerce product before it can be unlocked.");
      return;
    }

    setError("");
    const res = await fetch("/api/checkout/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productKey }),
    });
    const data = await res.json();
    if (data?.ok && data.url) window.location.href = data.url;
    else setError(data?.error || "Checkout could not be opened.");
  }

  return (
    <main className="share-page cos-uniform-page">
      <section className="share-phone cos-uniform-shell">
        <header className="share-topbar cos-page-topbar">
          <a href="/home" className="share-pill">‹ Home</a>
          <div className="share-top-actions">
            <a href="/apps/stats" className="share-pill">Stats</a>
            <a href="/apps/account" className="share-pill">Account</a>
          </div>
        </header>

        <section className="share-hero">
          <p>Caliphornia OS</p>
          <h1>Share</h1>
          <span>{statusCopy(step)}</span>
        </section>

        <section className={`airdrop-stage ${step}`} aria-label="Share transfer animation">
          <div className="airdrop-rings"><i /><i /><i /></div>
          <div className="airdrop-device sender"><span>♪</span><strong>You</strong></div>
          <div className="airdrop-beam"><span /></div>
          <div className="airdrop-device receiver"><span>⌁</span><strong>Listener</strong></div>
          <div className="share-transfer-label">
            <span>{shareScope === "project" ? "Project handoff" : "Song handoff"}</span>
            <strong>{selectedTitle}</strong>
          </div>
        </section>

        <section className="share-tabs">
          <button className={mode === "send" ? "active" : ""} onClick={() => setMode("send")}>Send</button>
          <button className={mode === "receive" ? "active" : ""} onClick={() => startReceive()}>Receive</button>
        </section>

        {mode === "send" ? (
          <section className="share-layout-grid">
            <section className="share-card share-project-browser">
              <div className="share-section-head">
                <div>
                  <p>Step 1</p>
                  <h2>Choose a project</h2>
                </div>
                <span>{projects.filter((project) => project.shareable).length} ready</span>
              </div>

              {loadingLibrary ? (
                <div className="share-empty">Loading your projects...</div>
              ) : projects.length ? (
                <div className="share-project-list">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={`share-project-row ${selectedProject?.id === project.id ? "active" : ""} ${project.shareable ? "" : "locked"}`}
                      onClick={() => selectProject(project)}
                    >
                      <span>{project.owned ? "Unlocked" : "Locked"}</span>
                      <strong>{project.name}</strong>
                      <small>
                        {project.shareable
                          ? `${project.shareableSongCount} ${plural(project.shareableSongCount, "song", "songs")} ready to share`
                          : project.unlockPrice
                            ? `Unlock from ${project.unlockPrice}`
                            : "Unlock required"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="share-empty">No projects are connected to Share yet.</div>
              )}
            </section>

            <section className="share-card share-send-card">
              <div className="share-section-head">
                <div>
                  <p>Step 2</p>
                  <h2>Choose what to send</h2>
                </div>
                <span>{selectedProject?.name || "Project"}</span>
              </div>

              <div className="share-scope-switch">
                <button
                  type="button"
                  className={shareScope === "song" ? "active" : ""}
                  onClick={() => setShareScope("song")}
                >
                  Song
                </button>
                <button
                  type="button"
                  className={shareScope === "project" ? "active" : ""}
                  onClick={() => setShareScope("project")}
                  disabled={!selectedProject?.shareable}
                >
                  Full Project
                </button>
              </div>

              {shareScope === "song" ? (
                <div className="share-song-list">
                  {shareableSongs.length ? (
                    shareableSongs.map((song) => (
                      <button
                        type="button"
                        key={song.id}
                        className={selectedSong?.slug === song.slug ? "active" : ""}
                        onClick={() => setSelectedSongSlug(song.slug)}
                      >
                        <span>{song.accessLabel}</span>
                        <strong>{song.title}</strong>
                        <small>{song.artist}</small>
                      </button>
                    ))
                  ) : (
                    <div className="share-empty">No songs are unlocked for sharing in this project yet.</div>
                  )}
                </div>
              ) : (
                <div className="share-project-summary">
                  <span>Project Share</span>
                  <strong>{selectedProject?.name}</strong>
                  <p>
                    The recipient gets one full guest listen for each song in this project, then can claim the experience into Music.
                  </p>
                  <div>{selectedProject?.shareableSongCount || 0} songs included</div>
                </div>
              )}

              {selectedProject && !selectedProject.owned ? (
                <div className="share-unlock-card">
                  <strong>Unlock to Share</strong>
                  <p>{selectedProject.name} must be unlocked before you can share the full project or its locked songs.</p>
                  <button type="button" onClick={() => startCheckout(selectedProject.unlockProductKey)}>
                    {selectedProject.unlockPrice ? `Unlock ${selectedProject.unlockPrice}` : "Open Checkout"}
                  </button>
                </div>
              ) : null}

              <button className="share-main-button" onClick={startShare}>
                {step === "sending" ? "Share running" : shareScope === "project" ? "Start Project Share" : "Start Song Share"}
              </button>

              {shareSessionId ? (
                <div className="share-output">
                  <span>Tell the recipient</span>
                  <strong>{phrase || "READY"}</strong>
                  <small>
                    Open <b>{receiveUrl || "/apps/share?mode=receive"}</b>, tap Receive, then accept the transfer that appears.
                  </small>
                </div>
              ) : null}
            </section>
          </section>
        ) : (
          <section className="share-card share-receive-card">
            <div className="share-section-head">
              <div>
                <p>Receive</p>
                <h2>Accept a nearby Share</h2>
              </div>
              <span>{guestSessionId ? "Listening" : "Ready"}</span>
            </div>

            <div className="share-instruction-card">
              <strong>How to receive</strong>
              <p>
                Ask the sender to start Share. You open Caliphornia OS, go to Share, tap Receive, then choose the transfer when it appears below.
              </p>
            </div>

            {!guestSessionId ? <button className="share-main-button" onClick={startReceive}>Start Receive</button> : null}

            <div className="candidate-list">
              {candidates.length ? candidates.map((candidate) => (
                <button key={candidate.id} className="candidate-card" onClick={() => acceptCandidate(candidate)}>
                  <span>From {candidate.sender_label}</span>
                  <strong>{candidate.title || candidate.song_title}</strong>
                  <small>{candidate.summary}</small>
                </button>
              )) : <div className="share-empty">No nearby shares yet. Keep this open while the sender starts Share.</div>}
            </div>
            {guestUrl ? <a href={guestUrl} className="share-main-link">Open guest player</a> : null}
          </section>
        )}

        {error ? <p className="share-error">{error}</p> : null}

        <section className="share-stats-card">
          <div><span>Your plays</span><strong>{stats.songsPlayed || 0}</strong></div>
          <div><span>Your qualified shares</span><strong>{stats.qualifiedShares || 0}</strong></div>
          <div><span>Global shares</span><strong>{stats.nearbyShares || 0}</strong></div>
          <div><span>Accounts from Share</span><strong>{stats.accountsCreated || 0}</strong></div>
          <a href="/apps/stats">Open full Stats</a>
        </section>
      </section>
    </main>
  );
}
