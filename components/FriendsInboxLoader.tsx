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
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/apps/friends/conversations", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data?.ok) {
          setError(data?.error || "Could not load Fri.ends.");
          setConversations([]);
          return;
        }
        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      } catch {
        if (active) setError("Could not load Fri.ends.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  return (
    <main className="app-shell friends-original-app-shell">
      <section className="screen screen-inbox is-active" aria-label="Fri.ends inbox">
        <div className="friends-original-inbox-topbar top-safe">
          <a href="/home" className="friends-original-back-btn" aria-label="Back to home">
            <span className="friends-original-back-chevron" aria-hidden="true"></span>
            <span className="friends-original-back-text">Home</span>
          </a>
          <a href="/apps/share" className="friends-original-thread-face-btn" aria-label="Share">⌁</a>
        </div>

        <header className="friends-original-inbox-header">
          <h1>Fri.ends</h1>
          <p>Conversations, audio messages, and final songs.</p>
        </header>

        {loading ? <div className="friends-original-empty-state">Loading conversations...</div> : null}
        {error ? <div className="friends-original-empty-state">{error}</div> : null}
        {!loading && !error ? <FriendsInboxClient conversations={conversations} /> : null}
      </section>
    </main>
  );
}
