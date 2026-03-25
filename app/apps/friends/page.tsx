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
              aria-label="Filter"
            >
              <span className="friends-original-filter-icon" aria-hidden="true"></span>
            </button>
          </div>

          <header className="friends-original-inbox-header">
            <h1>Fri.ends</h1>
          </header>

          <main className="friends-original-thread-list" aria-label="Track list">
            {conversations.map((thread: any) => (
              <Link
                key={thread.id}
                href={`/apps/friends/${thread.slug}`}
                className="friends-original-thread-row"
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
                  </div>

                  <div className="friends-original-thread-preview">
                    {thread.list_preview || ""}
                  </div>
                </div>

                <div className="friends-original-thread-time">
                  {thread.last_activity_label || ""}
                </div>
              </Link>
            ))}
          </main>

          <div className="friends-original-bottombar bottom-safe">
            <div className="friends-original-search-pill" aria-hidden="true">
              <span className="friends-original-search-icon"></span>
              <span className="friends-original-search-text">Search</span>
              <span className="friends-original-mic-icon"></span>
            </div>

            <button className="friends-original-compose-btn">
  <img
    src="/apps/friends/note.png"
    alt="Compose"
    className="friends-compose-icon"
  />
</button>
          </div>
        </section>
      </div>
    </main>
  );
}
