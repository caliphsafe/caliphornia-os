"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type GuestTrack = {
  entitlementId: string;
  songId: string;
  slug: string;
  title: string;
  artist: string;
  status: string;
  used: boolean;
};

type GuestData = {
  ok?: boolean;
  error?: string;
  playbackUrl?: string;
  entitlementId?: string;
  song?: {
    id: string;
    slug: string;
    title: string;
    artist: string;
  };
  playlist?: GuestTrack[];
};

export default function GuestPlayer({
  token,
}: {
  token: string;
}) {
  const [data, setData] =
    useState<GuestData | null>(null);
  const [activeTrack, setActiveTrack] =
    useState<GuestTrack | null>(null);
  const [claimEmail, setClaimEmail] =
    useState("");
  const [claimUsername, setClaimUsername] =
    useState("");
  const [needsUsername, setNeedsUsername] =
    useState(false);
  const [message, setMessage] = useState("");
  const [loadingTrack, setLoadingTrack] =
    useState(false);
  const [claiming, setClaiming] =
    useState(false);
  const audio = useRef<HTMLAudioElement | null>(
    null,
  );

  async function loadTrack(
    track?: GuestTrack | null,
  ) {
    setLoadingTrack(true);
    setMessage("");

    const params = new URLSearchParams({
      guestToken: token,
    });

    if (track?.entitlementId) {
      params.set(
        "entitlementId",
        track.entitlementId,
      );
    }

    if (track?.songId) {
      params.set("songId", track.songId);
    }

    const result = await fetch(
      `/api/guest/audio-url?${params.toString()}`,
      { cache: "no-store" },
    )
      .then((response) => response.json())
      .catch(() => ({
        ok: false,
        error:
          "Could not prepare the guest player.",
      }));

    setData(result);

    const selected =
      result?.playlist?.find(
        (item: GuestTrack) =>
          item.entitlementId ===
          result.entitlementId,
      ) ||
      result?.playlist?.find(
        (item: GuestTrack) =>
          item.songId === result?.song?.id,
      ) ||
      null;

    setActiveTrack(selected);
    setLoadingTrack(false);
  }

  useEffect(() => {
    void loadTrack(null);
  }, [token]);

  async function completeCurrentTrack() {
    if (
      !activeTrack?.entitlementId &&
      !data?.entitlementId
    ) {
      return;
    }

    const result = await fetch(
      "/api/guest/playback/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestToken: token,
          entitlementId:
            activeTrack?.entitlementId ||
            data?.entitlementId,
          songId:
            activeTrack?.songId ||
            data?.song?.id,
        }),
      },
    )
      .then((response) => response.json())
      .catch(() => ({ ok: false }));

    if (result?.ok) {
      setMessage(
        result.remaining > 0
          ? `${result.remaining} shared play${
              result.remaining === 1
                ? ""
                : "s"
            } left in this project.`
          : "Shared listen complete. Enter your email to keep it in Music.",
      );

      await loadTrack(null);
    }
  }

  async function createAccount() {
    if (!claimEmail.trim()) {
      setMessage("Enter your email.");
      return;
    }

    if (
      needsUsername &&
      !claimUsername.trim()
    ) {
      setMessage(
        "Choose a username to create your account.",
      );
      return;
    }

    setClaiming(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/guest/claim/start",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestToken: token,
            email: claimEmail,
            username:
              claimUsername.trim() || undefined,
          }),
        },
      );

      const result = await response.json();

      if (result?.needsUsername) {
        setNeedsUsername(true);
        setMessage(
          result?.error ||
            "Choose a username to finish creating your account.",
        );
        return;
      }

      if (!response.ok || !result?.ok) {
        setMessage(
          result?.error ||
            "Could not open your account.",
        );
        return;
      }

      window.location.href =
        result.redirectTo || "/apps/music";
    } catch {
      setMessage(
        "Could not open your account.",
      );
    } finally {
      setClaiming(false);
    }
  }

  const playlist = data?.playlist || [];
  const hasProjectShare =
    playlist.length > 1;

  return (
    <main className="guest-share-page">
      <section className="guest-share-phone">
        <header className="guest-share-topbar">
          <a
            href="/"
            className="guest-share-pill"
          >
            Caliphornia OS
          </a>
          <a
            href="/"
            className="guest-share-pill"
          >
            Open Caliphornia OS
          </a>
        </header>

        <section className="guest-share-hero">
          <p>
            {hasProjectShare
              ? "Project Share"
              : "Song Share"}
          </p>
          <h1>
            {data?.song?.title ||
              "Shared listening"}
          </h1>
          <span>
            {hasProjectShare
              ? "You received one full guest listen for each song in this project."
              : "You received one full guest listen before adding it to an account."}
          </span>
        </section>

        {playlist.length ? (
          <section className="guest-share-playlist">
            {playlist.map((track) => (
              <button
                key={track.entitlementId}
                type="button"
                className={
                  activeTrack?.entitlementId ===
                  track.entitlementId
                    ? "active"
                    : ""
                }
                disabled={
                  track.used || loadingTrack
                }
                onClick={() =>
                  loadTrack(track)
                }
              >
                <span>
                  {track.used
                    ? "Played"
                    : "Available"}
                </span>
                <strong>
                  {track.title}
                </strong>
                <small>
                  {track.artist}
                </small>
              </button>
            ))}
          </section>
        ) : null}

        <section className="guest-player-card">
          {data?.playbackUrl ? (
            <audio
              ref={audio}
              src={data.playbackUrl}
              controls
              autoPlay
              controlsList="nodownload noplaybackrate"
              onEnded={() =>
                void completeCurrentTrack()
              }
            />
          ) : (
            <p>
              {data?.error ||
                "Preparing your shared play..."}
            </p>
          )}
        </section>

        <section className="guest-claim-card">
          <p>Keep the experience</p>
          <h2>
            Add this song to Caliphornia OS.
          </h2>
          <span>
            Enter your email. If you already
            have an account, you will sign in
            and the shared song will be added
            to it. If this is a new account,
            you will choose a username next.
            No email verification is required.
          </span>

          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={claimEmail}
            disabled={needsUsername}
            onChange={(event) =>
              setClaimEmail(
                event.target.value,
              )
            }
          />

          {needsUsername ? (
            <input
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              value={claimUsername}
              onChange={(event) =>
                setClaimUsername(
                  event.target.value,
                )
              }
            />
          ) : null}

          <button
            type="button"
            className="primary"
            onClick={createAccount}
            disabled={claiming}
          >
            {claiming
              ? "Opening account..."
              : needsUsername
                ? "Create account and open Music"
                : "Continue with email"}
          </button>

          {message ? (
            <div className="guest-message">
              {message}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
