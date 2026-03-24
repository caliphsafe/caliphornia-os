import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/session";

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
    <main className="friends-screen">
      <div className="friends-shell">
        <div className="friends-topbar">
          <button className="friends-edit-btn">Edit</button>

          <button className="friends-filter-btn" aria-label="Filter conversations">
            <span />
            <span />
            <span />
          </button>
        </div>

        <h1 className="friends-title">Fri.ends</h1>

        <div className="friends-list">
          {conversations.map((conversation: any, index: number) => (
            <Link
              key={conversation.id}
              href={`/apps/friends/${conversation.slug}`}
              className="friends-row"
            >
              <div className="friends-row-avatar-wrap">
                {index === 0 ? <span className="friends-unread-dot" /> : null}
                <div className="friends-row-avatar">
                  {conversation.avatar_letter || conversation.title?.[0] || "F"}
                </div>
              </div>

              <div className="friends-row-main">
                <div className="friends-row-top">
                  <div className="friends-row-title">{conversation.title}</div>
                  <div className="friends-row-time">
                    {conversation.last_activity_label || ""}
                  </div>
                </div>

                <div className="friends-row-preview">
                  {conversation.list_preview || conversation.subtitle || ""}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="friends-bottom-tools">
          <div className="friends-search-pill">
            <span className="friends-search-icon">⌕</span>
            <span className="friends-search-text">Search</span>
            <span className="friends-mic-icon">◐</span>
          </div>

          <button className="friends-compose-btn" aria-label="Compose">
            ✎
          </button>
        </div>
      </div>
    </main>
  );
}