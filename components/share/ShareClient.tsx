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

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

function statusCopy(step: string) {
  if (step === "idle") {
    return "Choose a song or project, then start a nearby Share.";
  }

  if (step === "searching") {
    return "Starting Share. Keep this screen open.";
  }

  if (step === "sending") {
    return "Share is live. The receiver opens the Caliphornia OS lock screen nearby.";
  }

  if (step === "received") {
    return "Transfer accepted. The guest player is ready.";
  }

  return "Share is ready.";
}

function getPosition(): Promise<LocationPayload> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(
        new Error(
          "Location is required for proximity Share on this device.",
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy:
            typeof position.coords.accuracy === "number"
              ? Math.round(position.coords.accuracy)
              : null,
        });
      },
      () => {
        reject(
          new Error(
            "Allow location to start a proximity Share.",
          ),
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 15000,
      },
    );
  });
}

export default function ShareClient() {
  const [projects, setProjects] = useState<ShareProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] =
    useState("");
  const [selectedSongSlug, setSelectedSongSlug] =
    useState("");
  const [shareScope, setShareScope] =
    useState<"song" | "project">("song");
  const [shareSessionId, setShareSessionId] = useState("");
  const [phrase, setPhrase] = useState("");
  const [receiverInstruction, setReceiverInstruction] =
    useState("");
  const [guestToken, setGuestToken] = useState("");
  const [guestSessionId, setGuestSessionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [guestUrl, setGuestUrl] = useState("");
  const [mode, setMode] =
    useState<"send" | "receive">("send");
  const [step, setStep] = useState("idle");
  const [error, setError] = useState("");
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [stats, setStats] = useState<ShareStats>({});
  const [receiverLocation, setReceiverLocation] =
    useState<LocationPayload | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => project.id === selectedProjectId,
      ) ||
      projects[0] ||
      null,
    [projects, selectedProjectId],
  );

  const shareableSongs =
    selectedProject?.songs.filter((song) => song.shareable) ||
    [];

  const selectedSong = useMemo(
    () =>
      shareableSongs.find(
        (song) => song.slug === selectedSongSlug,
      ) ||
      shareableSongs[0] ||
      null,
    [shareableSongs, selectedSongSlug],
  );

  const selectedTitle =
    shareScope === "project"
      ? selectedProject?.name || "Project"
      : selectedSong?.title || "Song";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("mode") === "receive") {
      setMode("receive");
    }

    let active = true;

    async function load() {
      setLoadingLibrary(true);

      try {
        const [libraryResponse, statsResponse] =
          await Promise.all([
            fetch("/api/share/library", {
              cache: "no-store",
            }),
            fetch("/api/apps/stats?range=30d", {
              cache: "no-store",
            }).catch(() => null),
          ]);

        const libraryData =
          await libraryResponse.json();

        if (
          active &&
          Array.isArray(libraryData?.projects)
        ) {
          setProjects(libraryData.projects);

          const requestedSongId = params.get("songId");
          const requestedSongSlug = params.get("songSlug");
          const requestedProjectId =
            params.get("projectId");
          const requestedProjectSlug =
            params.get("projectSlug");
          const requestedScope =
            params.get("scope") === "project"
              ? "project"
              : "song";

          const requestedProject =
            libraryData.projects.find(
              (project: ShareProject) =>
                project.id === requestedProjectId ||
                project.slug === requestedProjectSlug ||
                project.songs?.some(
                  (song: ShareSong) =>
                    song.id === requestedSongId ||
                    song.slug === requestedSongSlug,
                ),
            );

          const initialProject =
            requestedProject ||
            libraryData.projects.find(
              (project: ShareProject) =>
                project.shareable,
            ) ||
            libraryData.projects[0];

          if (initialProject?.id) {
            setSelectedProjectId(initialProject.id);
            setShareScope(requestedScope);

            const initialSong =
              initialProject.songs?.find(
                (song: ShareSong) =>
                  song.shareable &&
                  (song.id === requestedSongId ||
                    song.slug === requestedSongSlug),
              ) ||
              initialProject.songs?.find(
                (song: ShareSong) => song.shareable,
              );

            if (initialSong?.slug) {
              setSelectedSongSlug(initialSong.slug);
            }
          }
        }

        if (statsResponse) {
          const statsData = await statsResponse
            .json()
            .catch(() => null);
          const my = statsData?.stats?.my || {};
          const global = statsData?.stats?.global || {};

          if (active) {
            setStats({
              songsPlayed: Number(my.songs_played || 0),
              nearbyShares: Number(
                global.nearby_shares || 0,
              ),
              qualifiedShares: Number(
                my.qualified_shares || 0,
              ),
              accountsCreated: Number(
                global.new_accounts_from_sharing || 0,
              ),
            });
          }
        }
      } catch {
        if (active) {
          setError(
            "Could not load your Share library yet.",
          );
        }
      } finally {
        if (active) setLoadingLibrary(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  function selectProject(project: ShareProject) {
    setSelectedProjectId(project.id);

    const firstSong = project.songs.find(
      (song) => song.shareable,
    );

    setSelectedSongSlug(firstSong?.slug || "");

    if (!project.shareable && shareScope === "project") {
      setShareScope("song");
    }
  }

  async function startShare() {
    setError("");
    setGuestUrl("");
    setShareSessionId("");

    if (!selectedProject) {
      setError("Choose a project first.");
      return;
    }

    if (shareScope === "song" && !selectedSong) {
      setError("Choose a shareable song first.");
      return;
    }

    if (
      shareScope === "project" &&
      !selectedProject.shareable
    ) {
      setError(
        `Unlock ${selectedProject.name} before sharing the full project.`,
      );
      return;
    }

    setStep("searching");

    try {
      const location = await getPosition();

      const response = await fetch("/api/share/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareScope,
          projectId: selectedProject.id,
          projectSlug: selectedProject.slug,
          songSlug: selectedSong?.slug,
          location,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Could not start Share.",
        );
      }

      setShareSessionId(data.shareSessionId || "");
      setPhrase(data.phrase || "");
      setReceiverInstruction(
        data.receiverInstruction ||
          "The receiver opens the Caliphornia OS lock screen near you and accepts the notification.",
      );
      setStep("sending");
    } catch (shareError) {
      setStep("idle");
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Could not start Share.",
      );
    }
  }

  async function startReceive() {
    setMode("receive");
    setError("");
    setGuestUrl("");
    setStep("searching");

    try {
      const location = await getPosition();
      setReceiverLocation(location);

      const response = await fetch(
        "/api/nearby/receive/start",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceLabel: "Caliphornia listener",
            location,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Could not start receiver.",
        );
      }

      setGuestToken(data.guestToken || "");
      setGuestSessionId(data.guestSessionId || "");

      await pollCandidates(data.guestToken, location);

      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }

      pollRef.current = window.setInterval(
        () =>
          void pollCandidates(
            data.guestToken,
            location,
          ),
        3000,
      );
    } catch (receiveError) {
      setStep("idle");
      setError(
        receiveError instanceof Error
          ? receiveError.message
          : "Could not start receiver.",
      );
    }
  }

  async function pollCandidates(
    token = guestToken,
    location = receiverLocation,
  ) {
    if (!token || !location) return;

    try {
      const params = new URLSearchParams({
        guestToken: token,
        lat: String(location.latitude),
        lng: String(location.longitude),
      });

      if (location.accuracy != null) {
        params.set(
          "accuracy",
          String(location.accuracy),
        );
      }

      const response = await fetch(
        `/api/nearby/receive/candidates?${params.toString()}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (data?.ok && Array.isArray(data.candidates)) {
        setCandidates(data.candidates);
      }
    } catch {
      // Keep polling quietly.
    }
  }

  async function acceptCandidate(candidate: Candidate) {
    setError("");

    try {
      const response = await fetch(
        "/api/nearby/receive/confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestToken,
            shareSessionId: candidate.id,
            location: receiverLocation,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Could not accept Share.",
        );
      }

      setGuestUrl(data.guestUrl || "");
      setStep("received");

      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }

      window.location.href =
        data.guestUrl ||
        `/guest/${encodeURIComponent(guestToken)}`;
    } catch (candidateError) {
      setError(
        candidateError instanceof Error
          ? candidateError.message
          : "Could not accept Share.",
      );
    }
  }

  async function startCheckout(
    productKey?: string | null,
  ) {
    if (!productKey) {
      setError(
        "This project needs an active commerce product before it can be unlocked.",
      );
      return;
    }

    setError("");

    const response = await fetch(
      "/api/checkout/access",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      },
    );

    const data = await response.json();

    if (data?.ok && data.url) {
      window.location.href = data.url;
    } else {
      setError(
        data?.error || "Checkout could not be opened.",
      );
    }
  }

  return (
    <main className="share-page cos-uniform-page">
      <section className="share-phone cos-uniform-shell">
        <header className="share-topbar cos-page-topbar">
          <a href="/home" className="share-pill">
            ‹ Home
          </a>
          <div className="share-top-actions">
            <a href="/apps/stats" className="share-pill">
              Stats
            </a>
            <a href="/apps/account" className="share-pill">
              Account
            </a>
          </div>
        </header>

        <section className="share-hero">
          <p>Caliphornia OS</p>
          <h1>Share</h1>
          <span>{statusCopy(step)}</span>
        </section>

        <section
          className={`airdrop-stage ${step}`}
          aria-label="Share transfer animation"
        >
          <div className="airdrop-rings">
            <i />
            <i />
            <i />
          </div>
          <div className="airdrop-device sender">
            <span>♪</span>
            <strong>You</strong>
          </div>
          <div className="airdrop-beam">
            <span />
          </div>
          <div className="airdrop-device receiver">
            <span>⌁</span>
            <strong>Nearby</strong>
          </div>
          <div className="share-transfer-label">
            <span>
              {shareScope === "project"
                ? "Project Share"
                : "Song Share"}
            </span>
            <strong>{selectedTitle}</strong>
          </div>
        </section>

        <section className="share-tabs">
          <button
            type="button"
            className={mode === "send" ? "active" : ""}
            onClick={() => setMode("send")}
          >
            Send
          </button>
          <button
            type="button"
            className={
              mode === "receive" ? "active" : ""
            }
            onClick={() => void startReceive()}
          >
            Receive
          </button>
        </section>

        {mode === "send" ? (
          <section className="share-card share-picker">
            <div className="share-section-head">
              <div>
                <p>Choose what to share</p>
                <h2>Your Music</h2>
              </div>
              <span>
                {
                  projects.filter(
                    (project) => project.shareable,
                  ).length
                }{" "}
                ready
              </span>
            </div>

            {loadingLibrary ? (
              <div className="share-empty">
                Loading your Music...
              </div>
            ) : projects.length ? (
              <>
                <div
                  className="share-project-strip"
                  aria-label="Projects"
                >
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={`share-project-tile ${
                        selectedProject?.id === project.id
                          ? "active"
                          : ""
                      } ${
                        project.shareable ? "" : "locked"
                      }`}
                      onClick={() =>
                        selectProject(project)
                      }
                    >
                      <span>
                        {project.owned
                          ? "Unlocked"
                          : "Locked"}
                      </span>
                      <strong>{project.name}</strong>
                      <small>
                        {project.shareableSongCount} songs
                      </small>
                    </button>
                  ))}
                </div>

                <div className="share-picker-toolbar">
                  <div>
                    <span>Selected project</span>
                    <strong>
                      {selectedProject?.name || "Project"}
                    </strong>
                  </div>

                  <div className="share-scope-switch">
                    <button
                      type="button"
                      className={
                        shareScope === "song"
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setShareScope("song")
                      }
                    >
                      Song
                    </button>
                    <button
                      type="button"
                      className={
                        shareScope === "project"
                          ? "active"
                          : ""
                      }
                      disabled={
                        !selectedProject?.shareable
                      }
                      onClick={() =>
                        setShareScope("project")
                      }
                    >
                      Album
                    </button>
                  </div>
                </div>

                {shareScope === "song" ? (
                  <div
                    className="share-song-strip"
                    aria-label="Songs"
                  >
                    {shareableSongs.length ? (
                      shareableSongs.map((song, index) => (
                        <button
                          type="button"
                          key={song.id}
                          className={
                            selectedSong?.slug === song.slug
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            setSelectedSongSlug(song.slug)
                          }
                        >
                          <span>
                            {String(index + 1).padStart(
                              2,
                              "0",
                            )}
                          </span>
                          <strong>{song.title}</strong>
                          <small>{song.artist}</small>
                        </button>
                      ))
                    ) : (
                      <div className="share-empty">
                        No songs are unlocked for
                        sharing in this project.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="share-project-summary compact">
                    <span>Album Share</span>
                    <strong>
                      {selectedProject?.name}
                    </strong>
                    <p>
                      The receiver gets one guest listen
                      for each included song.
                    </p>
                    <div>
                      {selectedProject?.shareableSongCount ||
                        0}{" "}
                      songs included
                    </div>
                  </div>
                )}

                {selectedProject &&
                !selectedProject.owned ? (
                  <div className="share-unlock-card">
                    <strong>Unlock to Share</strong>
                    <p>
                      Unlock {selectedProject.name} to
                      share its locked music.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void startCheckout(
                          selectedProject.unlockProductKey,
                        )
                      }
                    >
                      {selectedProject.unlockPrice
                        ? `Unlock ${selectedProject.unlockPrice}`
                        : "Open Checkout"}
                    </button>
                  </div>
                ) : null}

                <div className="share-selection-summary">
                  <div>
                    <span>Ready to share</span>
                    <strong>{selectedTitle}</strong>
                  </div>
                  <button
                    type="button"
                    className="share-main-button"
                    onClick={() => void startShare()}
                  >
                    {step === "sending"
                      ? "Share running"
                      : "Start Share"}
                  </button>
                </div>

                {shareSessionId ? (
                  <div className="share-output">
                    <span>Share is live nearby</span>
                    <strong>{phrase || "READY"}</strong>
                    <small>{receiverInstruction}</small>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="share-empty">
                No projects are connected to Share yet.
              </div>
            )}
          </section>
        ) : (
          <section className="share-card share-receive-card">
            <div className="share-section-head">
              <div>
                <p>Receive</p>
                <h2>Accept a nearby Share</h2>
              </div>
              <span>
                {guestSessionId ? "Listening" : "Ready"}
              </span>
            </div>

            <div className="share-instruction-card">
              <strong>Lock-screen Receive</strong>
              <p>
                The receiver can open the Caliphornia OS
                lock screen nearby and accept the Share
                notification without an account.
              </p>
            </div>

            {!guestSessionId ? (
              <button
                type="button"
                className="share-main-button"
                onClick={() => void startReceive()}
              >
                Start Receive on this device
              </button>
            ) : null}

            <div className="candidate-list">
              {candidates.length ? (
                candidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    className="candidate-card"
                    onClick={() =>
                      void acceptCandidate(candidate)
                    }
                  >
                    <span>
                      From {candidate.sender_label}
                    </span>
                    <strong>
                      {candidate.title ||
                        candidate.song_title}
                    </strong>
                    <small>{candidate.summary}</small>
                  </button>
                ))
              ) : (
                <div className="share-empty">
                  No nearby shares yet. Keep this open
                  while the sender starts Share.
                </div>
              )}
            </div>

            {guestUrl ? (
              <a
                href={guestUrl}
                className="share-main-link"
              >
                Open guest player
              </a>
            ) : null}
          </section>
        )}

        {error ? (
          <p className="share-error">{error}</p>
        ) : null}

        <section className="share-stats-card">
          <div>
            <span>Your plays</span>
            <strong>{stats.songsPlayed || 0}</strong>
          </div>
          <div>
            <span>Qualified shares</span>
            <strong>{stats.qualifiedShares || 0}</strong>
          </div>
          <div>
            <span>Global shares</span>
            <strong>{stats.nearbyShares || 0}</strong>
          </div>
          <div>
            <span>New accounts</span>
            <strong>{stats.accountsCreated || 0}</strong>
          </div>
          <a href="/apps/stats">Open full Stats</a>
        </section>
      </section>
    </main>
  );
}
