"use client";

import { useEffect, useState } from "react";
import FriendsInboxClient from "@/components/FriendsInboxClient";

export default function FriendsInboxLoader() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/apps/friends/conversations", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok || !data?.ok) {
          setError(data?.error || "Fri.ends could not load.");
          setState("error");
          return;
        }
        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
        setState("ready");
      } catch {
        if (!mounted) return;
        setError("Fri.ends could not load.");
        setState("error");
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  if (state !== "ready") {
    return (
      <main className="friends-original-app-shell">
        <section className="screen screen-inbox is-active">
          <div className="friends-original-inbox-topbar top-safe">
            <a href="/home" className="friends-original-back-btn">‹ Home</a>
            <h1>fri.ends</h1>
          </div>
          <div className="friends-original-thread-list">
            <div className="friends-original-thread-row">
              <div className="friends-original-thread-avatar group">{state === "loading" ? "F" : "!"}</div>
              <div className="friends-original-thread-main">
                <div className="friends-original-thread-title">{state === "loading" ? "Loading conversations..." : "Could not load Fri.ends"}</div>
                <div className="friends-original-thread-preview">{state === "loading" ? "Reconnecting message threads." : error}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="friends-original-app-shell">
      <section className="screen screen-inbox is-active" aria-label="Fri.ends inbox">
        <div className="friends-original-inbox-topbar top-safe">
          <a href="/home" className="friends-original-back-btn">‹ Home</a>
          <h1>fri.ends</h1>
          <a href="/apps/share" className="friends-original-thread-face-btn" aria-label="Share">⌁</a>
        </div>
        <FriendsInboxClient conversations={conversations} />
      </section>
    </main>
  );
}
