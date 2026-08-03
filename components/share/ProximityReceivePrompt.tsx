"use client";

import { useEffect, useRef, useState } from "react";

type Candidate = {
  id: string;
  title?: string;
  song_title?: string;
  sender_label?: string;
  summary?: string;
  distance_meters?: number | null;
  proximity_label?: string;
  scope?: "song" | "project";
  songCount?: number;
};

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

function canUseLocation() {
  return (
    typeof window !== "undefined" &&
    "geolocation" in navigator
  );
}

function getPosition(): Promise<LocationPayload> {
  return new Promise((resolve, reject) => {
    if (!canUseLocation()) {
      reject(
        new Error("Location is not available on this device."),
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
            "Location permission is needed to receive nearby shares.",
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

export default function ProximityReceivePrompt() {
  const [phase, setPhase] = useState<
    "quiet" | "ready" | "checking" | "found" | "accepting" | "error"
  >("quiet");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [guestToken, setGuestToken] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState<LocationPayload | null>(
    null,
  );
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function autoCheckIfAllowed() {
      if (!canUseLocation()) {
        setPhase("quiet");
        return;
      }

      try {
        const permissionsApi = (
          navigator as Navigator & {
            permissions?: Permissions;
          }
        ).permissions;

        if (!permissionsApi?.query) {
          setPhase("ready");
          return;
        }

        const result = await permissionsApi.query({
          name: "geolocation",
        });

        if (cancelled) return;

        if (result.state === "granted") {
          void startReceive(false);
        } else {
          setPhase("ready");
        }
      } catch {
        if (!cancelled) setPhase("ready");
      }
    }

    const timer = window.setTimeout(autoCheckIfAllowed, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);

      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  async function startReceive(showErrors = true) {
    setError("");
    setCandidate(null);
    setPhase("checking");

    try {
      const nextLocation = await getPosition();
      setLocation(nextLocation);

      const response = await fetch("/api/nearby/receive/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceLabel: "Nearby listener",
          location: nextLocation,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Could not start Receive.",
        );
      }

      const token = data.guestToken || "";
      setGuestToken(token);

      await pollCandidates(token, nextLocation);

      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }

      pollRef.current = window.setInterval(() => {
        void pollCandidates(token, nextLocation);
      }, 2500);
    } catch (receiveError) {
      setPhase(showErrors ? "error" : "ready");
      setError(
        receiveError instanceof Error
          ? receiveError.message
          : "Could not check for nearby shares.",
      );
    }
  }

  async function pollCandidates(
    token = guestToken,
    currentLocation = location,
  ) {
    if (!token || !currentLocation) return;

    const params = new URLSearchParams({
      guestToken: token,
      lat: String(currentLocation.latitude),
      lng: String(currentLocation.longitude),
    });

    if (currentLocation.accuracy != null) {
      params.set(
        "accuracy",
        String(currentLocation.accuracy),
      );
    }

    const response = await fetch(
      `/api/nearby/receive/candidates?${params.toString()}`,
      { cache: "no-store" },
    );

    const data = await response.json().catch(() => null);
    const nextCandidate = Array.isArray(data?.candidates)
      ? data.candidates[0]
      : null;

    if (nextCandidate?.id) {
      setCandidate(nextCandidate);
      setPhase("found");
    } else {
      setPhase((currentPhase) =>
        currentPhase === "found" ? currentPhase : "checking",
      );
    }
  }

  async function acceptCandidate() {
    if (!candidate?.id || !guestToken) return;

    setPhase("accepting");
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
            location,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Could not accept this Share.",
        );
      }

      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }

      window.location.href =
        data.guestUrl ||
        `/guest/${encodeURIComponent(guestToken)}`;
    } catch (acceptError) {
      setPhase("found");
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept this Share.",
      );
    }
  }

  if (phase === "quiet") return null;

  const songTitle =
    candidate?.song_title ||
    candidate?.title ||
    "a shared song";
  const senderName =
    candidate?.sender_label || "Someone nearby";
  const isFound =
    phase === "found" || phase === "accepting";

  return (
    <aside className="lock-share-notification" aria-live="polite">
      <div className="lock-share-header">
        <div className="lock-share-icon" aria-hidden="true">
          ⌁
        </div>

        <div className="lock-share-copy">
          <div className="lock-share-app-label">
            Caliphornia Share
          </div>

          <strong>
            {isFound
              ? `${senderName} wants to share ${songTitle} with you.`
              : phase === "checking"
                ? "Looking for a nearby Share…"
                : "Receive a nearby song"}
          </strong>

          {!isFound ? (
            <span>
              Stand near the sender and allow location access.
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="lock-share-error">{error}</div>
      ) : null}

      {isFound ? (
        <button
          type="button"
          className="lock-share-button primary"
          onClick={acceptCandidate}
          disabled={phase === "accepting"}
        >
          {phase === "accepting"
            ? "Opening…"
            : "Receive and listen"}
        </button>
      ) : (
        <button
          type="button"
          className="lock-share-button"
          onClick={() => startReceive(true)}
        >
          {phase === "checking"
            ? "Checking nearby…"
            : "Receive nearby"}
        </button>
      )}
    </aside>
  );
}
