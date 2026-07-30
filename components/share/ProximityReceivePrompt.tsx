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
  return typeof window !== "undefined" && "geolocation" in navigator;
}

function getPosition(): Promise<LocationPayload> {
  return new Promise((resolve, reject) => {
    if (!canUseLocation()) {
      reject(new Error("Location is not available on this device."));
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
      () => reject(new Error("Location permission is needed to receive nearby shares.")),
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 15000,
      }
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
  const [location, setLocation] = useState<LocationPayload | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function autoCheckIfAllowed() {
      if (!canUseLocation()) {
        setPhase("quiet");
        return;
      }

      try {
        const permissionsApi = (navigator as any).permissions;
        if (!permissionsApi?.query) {
          setPhase("ready");
          return;
        }

        const result = await permissionsApi.query({ name: "geolocation" as PermissionName });
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
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function startReceive(showErrors = true) {
    setError("");
    setCandidate(null);
    setPhase("checking");

    try {
      const nextLocation = await getPosition();
      setLocation(nextLocation);

      const res = await fetch("/api/nearby/receive/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceLabel: "Nearby listener",
          location: nextLocation,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Could not start Receive.");
      }

      const token = data.guestToken || "";
      setGuestToken(token);

      await pollCandidates(token, nextLocation);

      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void pollCandidates(token, nextLocation);
      }, 2500);
    } catch (err) {
      setPhase(showErrors ? "error" : "ready");
      setError(err instanceof Error ? err.message : "Could not check for nearby shares.");
    }
  }

  async function pollCandidates(token = guestToken, loc = location) {
    if (!token || !loc) return;

    const params = new URLSearchParams({
      guestToken: token,
      lat: String(loc.latitude),
      lng: String(loc.longitude),
    });

    if (loc.accuracy != null) params.set("accuracy", String(loc.accuracy));

    const res = await fetch(`/api/nearby/receive/candidates?${params.toString()}`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    const nextCandidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;

    if (nextCandidate?.id) {
      setCandidate(nextCandidate);
      setPhase("found");
    } else if (phase !== "found") {
      setPhase("checking");
    }
  }

  async function acceptCandidate() {
    if (!candidate?.id || !guestToken) return;

    setPhase("accepting");
    setError("");

    try {
      const res = await fetch("/api/nearby/receive/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestToken,
          shareSessionId: candidate.id,
          location,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Could not accept this Share.");
      }

      if (pollRef.current) window.clearInterval(pollRef.current);
      window.location.href = data.guestUrl || `/guest/${encodeURIComponent(guestToken)}`;
    } catch (err) {
      setPhase("found");
      setError(err instanceof Error ? err.message : "Could not accept this Share.");
    }
  }

  if (phase === "quiet") return null;

  const title = candidate?.title || candidate?.song_title || "a shared song";
  const isFound = phase === "found" || phase === "accepting";

  return (
    <aside
      style={{
        position: "fixed",
        left: "50%",
        top: "calc(14px + env(safe-area-inset-top, 0px))",
        zIndex: 90,
        width: "min(390px, calc(100vw - 28px))",
        maxHeight: "min(360px, calc(100dvh - 28px))",
        overflowY: "auto",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
      }}
      aria-live="polite"
    >
      <div
        style={{
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.18)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.08)), rgba(10,12,20,.86)",
          boxShadow: "0 28px 90px rgba(0,0,0,.46)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          padding: 14,
          color: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,.34), transparent 32%), linear-gradient(145deg, #4aa3ff, #7b61ff)",
              boxShadow: "0 18px 40px rgba(74,163,255,.32)",
              flex: "0 0 auto",
              fontSize: 26,
            }}
          >
            ⌁
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                color: "rgba(255,255,255,.62)",
                fontWeight: 900,
              }}
            >
              Nearby Share
            </div>
            <strong
              style={{
                display: "block",
                marginTop: 2,
                fontSize: 17,
                lineHeight: 1.08,
                letterSpacing: "-.03em",
              }}
            >
              {isFound ? title : "Receive music near you"}
            </strong>
            <span
              style={{
                display: "block",
                marginTop: 4,
                color: "rgba(255,255,255,.68)",
                fontSize: 13,
                lineHeight: 1.28,
              }}
            >
              {isFound
                ? `${candidate?.sender_label || "A listener nearby"} is sharing ${
                    candidate?.summary || "1 guest listen"
                  }.`
                : phase === "checking"
                  ? "Checking for nearby Share sessions."
                  : "Stand near the sender and allow location to receive without an account."}
            </span>
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 18,
              background: "rgba(255,69,58,.12)",
              border: "1px solid rgba(255,69,58,.22)",
              color: "rgba(255,235,235,.94)",
              fontSize: 13,
              lineHeight: 1.3,
            }}
          >
            {error}
          </div>
        ) : null}

        {isFound ? (
          <button
            type="button"
            onClick={acceptCandidate}
            disabled={phase === "accepting"}
            style={{
              minHeight: 50,
              borderRadius: 999,
              border: 0,
              color: "#06101d",
              background: "linear-gradient(180deg, #ffffff, #a8d8ff)",
              fontWeight: 900,
              letterSpacing: "-.02em",
              cursor: "pointer",
            }}
          >
            {phase === "accepting" ? "Opening..." : "Receive and listen"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => startReceive(true)}
            style={{
              minHeight: 50,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.16)",
              color: "#fff",
              background: "rgba(255,255,255,.12)",
              fontWeight: 900,
              letterSpacing: "-.02em",
              cursor: "pointer",
            }}
          >
            {phase === "checking" ? "Checking nearby..." : "Receive nearby"}
          </button>
        )}
      </div>
    </aside>
  );
}
