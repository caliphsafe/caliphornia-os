"use client";

import { useEffect, useState } from "react";

type ClaimState = {
  ok?: boolean;
  error?: string;
  guestUrl?: string;
  songCount?: number;
  scope?: string;
  title?: string;
};

export default function ShareUnlockClient({ shareToken }: { shareToken: string }) {
  const [claim, setClaim] = useState<ClaimState | null>(null);
  const [loading, setLoading] = useState(Boolean(shareToken));

  useEffect(() => {
    let active = true;

    async function activateShare() {
      if (!shareToken) {
        setLoading(false);
        setClaim({ ok: false, error: "This Share link is missing its code." });
        return;
      }

      setLoading(true);
      const result = await fetch("/api/share/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      })
        .then((res) => res.json())
        .catch(() => ({ ok: false, error: "Could not activate this Share." }));

      if (!active) return;
      setClaim(result);
      setLoading(false);

      if (result?.ok && result?.guestUrl) {
        window.setTimeout(() => {
          window.location.href = result.guestUrl;
        }, 1100);
      }
    }

    void activateShare();

    return () => {
      active = false;
    };
  }, [shareToken]);

  return (
    <main className="share-unlock-page">
      <section className="share-unlock-phone cos-uniform-shell">
        <header className="share-unlock-topbar">
          <a href="/" className="share-unlock-pill">Caliphornia OS</a>
        </header>

        <section className="share-unlock-orb" aria-label="Share activation animation">
          <div className="share-unlock-rings"><i /><i /><i /></div>
          <div className="share-unlock-core">⌁</div>
        </section>

        <section className="share-unlock-card">
          <p>Private Share</p>
          <h1>{claim?.title || "Activating shared listen"}</h1>
          <span>
            {loading
              ? "Preparing your guest listen. No account is required."
              : claim?.ok
                ? `${claim.songCount || 1} shared ${claim.songCount === 1 ? "song" : "songs"} ready. Opening your guest player now.`
                : claim?.error || "This Share could not be activated."}
          </span>

          {claim?.ok && claim.guestUrl ? (
            <a href={claim.guestUrl} className="share-unlock-primary">Open guest player</a>
          ) : null}

          {!loading && !claim?.ok ? (
            <div className="share-unlock-help">
              <strong>What to do next</strong>
              <span>Ask the sender to create a fresh Share link from Caliphornia OS. Then open that link here.</span>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
