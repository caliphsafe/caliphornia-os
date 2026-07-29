"use client";

import { useEffect, useState } from "react";
import FriendsInboxClient from "@/components/FriendsInboxClient";

type Conversation = {
  id: string;
  slug: string;
  title: string;
  avatar_letter?: string | null;
  list_preview?: string | null;
  last_activity_label?: string | null;
  sort_order?: number | null;
  can_open_conversation?: boolean;
  locked_reason?: string | null;
  final_track?: any;
};

export default function FriendsInboxLoader() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/apps/friends/conversations", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!alive) return;

        if (!res.ok || !data.ok) {
          setError(data?.error || "Could not load fri.ends.");
          setConversations([]);
          return;
        }

        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      } catch {
        if (!alive) return;
        setError("Could not load fri.ends.");
        setConversations([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="app-shell friends-original-app-shell">
      <section className="screen screen-inbox is-active" aria-label="Fri.ends inbox">
        <div className="friends-original-topbar top-safe">
          <a href="/home" className="friends-original-back-home" aria-label="Back home">
            ‹
          </a>

          <div className="friends-original-title-wrap">
            <div className="friends-original-title">fri.ends</div>
            <div className="friends-original-subtitle">texts, voice notes, and songs</div>
          </div>

          <a href="/apps/nearby" className="friends-original-compose-btn" aria-label="Nearby Share">
            ⌁
          </a>
        </div>

        {loading ? (
          <main className="friends-original-thread-list" aria-label="Loading conversations">
            <div className="friends-original-thread-row">
              <div className="friends-original-thread-avatar group">F</div>
              <div className="friends-original-thread-main">
                <div className="friends-original-thread-topline">
                  <div className="friends-original-thread-title">Loading fri.ends</div>
                </div>
                <div className="friends-original-thread-preview">Getting conversations ready...</div>
              </div>
            </div>
          </main>
        ) : error ? (
          <main className="friends-original-thread-list" aria-label="Fri.ends error">
            <div className="friends-original-thread-row">
              <div className="friends-original-thread-avatar group">!</div>
              <div className="friends-original-thread-main">
                <div className="friends-original-thread-topline">
                  <div className="friends-original-thread-title">fri.ends could not load</div>
                </div>
                <div className="friends-original-thread-preview">{error}</div>
              </div>
            </div>
          </main>
        ) : (
          <FriendsInboxClient conversations={conversations} />
        )}
      </section>
    </div>
  );
}
