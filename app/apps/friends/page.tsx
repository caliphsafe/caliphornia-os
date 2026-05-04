import "./friends.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import Link from "next/link";

async function getConversations() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;

  const res = await fetch(
    `${normalizedBase}/api/apps/friends/conversations`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data?.conversations || [];
}

export default async function FriendsPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  const conversations = await getConversations();

  return (
    <main className="friends-original-app">
      <div className="friends-original-shell">
        <section
          className="friends-original-screen friends-original-screen-inbox is-active"
          aria-label="Fri.ends inbox"
        >
          <div className="friends-original-topbar top-safe">
            <Link
              href="/home"
              className="friends-notes-back-btn"
              aria-label="Back to home"
              prefetch
            >
              <img
                src="/apps/friends/back.png"
                alt="Back"
                className="friends-notes-back-icon"
              />
            </Link>

            <button
              className="friends-original-icon-btn ghost-btn"
              type="button"
              aria-label="More"
            >
              <img
                src="/apps/friends/more.png"
                alt="More"
                className="friends-topbar-icon"
              />
            </button>
          </div>

          <header className="friends-original-inbox-header">
            <h1>Fri.ends</h1>
          </header>

          <main
            className="friends-original-thread-list"
            aria-label="Track list"
          >
            {conversations.map((thread: any) => {
              const href = thread.can_open_conversation
                ? `/apps/friends/${thread.slug}`
                : `/apps/friends?preview=${thread.slug}`;

              return (
                <Link
                  key={thread.id}
                  href={href}
                  className={`friends-original-thread-row ${
                    thread.can_open_conversation ? "" : "is-preview-only"
                  }`}
                  aria-label={
                    thread.can_open_conversation
                      ? `Open conversation with ${thread.title}`
                      : `Play preview for ${thread.title}`
                  }
                  prefetch={thread.can_open_conversation}
                  data-preview-only={thread.can_open_conversation ? "false" : "true"}
                  data-preview-slug={thread.slug}
                  data-preview-track={
                    !thread.can_open_conversation && thread.final_track
                      ? JSON.stringify(thread.final_track)
                      : ""
                  }
                  data-preview-conversations={
                    !thread.can_open_conversation
                      ? JSON.stringify(conversations)
                      : ""
                  }
                >
                  {thread.sort_order === 1 ? (
                    <span className="friends-original-thread-unread-dot"></span>
                  ) : null}

                  <div className="friends-original-thread-avatar group">
                    {thread.avatar_letter || thread.title?.[0] || "F"}
                  </div>

                  <div className="friends-original-thread-main">
                    <div className="friends-original-thread-topline">
                      <div className="friends-original-thread-title">
                        {thread.title}
                      </div>

                      {!thread.can_open_conversation ? (
                        <span className="friends-preview-badge">Preview</span>
                      ) : null}
                    </div>

                    <div className="friends-original-thread-preview">
                      {thread.can_open_conversation
                        ? thread.list_preview || ""
                        : thread.locked_reason || "Unlock Fri.ends to view the full conversation."}
                    </div>
                  </div>

                  <div className="friends-original-thread-time">
                    {thread.can_open_conversation
                      ? thread.last_activity_label || ""
                      : "30s"}
                  </div>
                </Link>
              );
            })}
          </main>

          <div className="friends-original-bottombar bottom-safe">
            <div className="friends-original-search-pill" aria-hidden="true">
              <span className="friends-original-search-icon"></span>
              <span className="friends-original-search-text">Search</span>
              <img
                src="/apps/friends/mic.png"
                alt="Mic"
                className="friends-search-mic-icon"
              />
            </div>

            <button
              className="friends-original-compose-btn friends-original-circle-btn"
              type="button"
              aria-label="Compose"
            >
              <img
                src="/apps/friends/note.png"
                alt="Compose"
                className="friends-compose-icon"
              />
            </button>
          </div>
        </section>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("click", function(event) {
              var row = event.target.closest("[data-preview-only='true']");
              if (!row) return;

              event.preventDefault();

              try {
                var rawConversations = row.getAttribute("data-preview-conversations") || "[]";
                var conversations = JSON.parse(rawConversations);

                var tracks = conversations
                  .map(function(convo) {
                    var track = convo.final_track;
                    if (!track || !track.file) return null;

                    return {
                      id: track.slug,
                      slug: track.slug,
                      title: track.title,
                      artist: track.artist || "Caliph",
                      displayTitle: track.title,
                      file: track.file,
                      playlistSongSlug: track.playlist_song_slug || track.slug,
                      analyticsSongSlug: track.analytics_song_slug || track.slug,
                      sourceApp: "friends",
                      conversationSlug: convo.slug,
                      conversationRoute: "/apps/friends/" + convo.slug,
                      isPreview: Boolean(track.is_preview),
                      clipStartSeconds: track.clip_start_seconds,
                      clipEndSeconds: track.clip_end_seconds
                    };
                  })
                  .filter(Boolean);

                var previewSlug = row.getAttribute("data-preview-slug");
                var startIndex = Math.max(
                  0,
                  tracks.findIndex(function(track) {
                    return track.conversationSlug === previewSlug;
                  })
                );

                if (!tracks.length) return;

                window.postMessage(
                  {
                    type: "CALIPH_PLAYER_TOGGLE_TRACK",
                    tracks: tracks,
                    startIndex: startIndex
                  },
                  "*"
                );
              } catch (error) {
                console.error("Failed to play Friends preview", error);
              }
            });
          `,
        }}
      />
    </main>
  );
}