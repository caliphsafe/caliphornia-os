import "./friends.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import Link from "next/link";
import FriendsInboxClient from "@/components/FriendsInboxClient";
import AccessWindow from "@/components/AccessWindow";

async function getConversations(sessionToken: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;

  const res = await fetch(
    `${normalizedBase}/api/apps/friends/conversations`,
    {
      cache: "no-store",
      headers: {
        Cookie: `caliph_os_session=${sessionToken}`,
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data?.conversations || [];
}

export default async function FriendsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("caliph_os_session")?.value ?? "";
  const session = verifySession(sessionToken);

  if (!session) {
    redirect("/");
  }

  const conversations = await getConversations(sessionToken);

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

            <AccessWindow
              projectSlug="friends"
              projectName="Fri.ends"
              triggerClassName="friends-original-icon-btn ghost-btn"
              triggerImgClassName="friends-topbar-icon"
            />
          </div>

          <header className="friends-original-inbox-header">
            <h1>Fri.ends</h1>
          </header>

          <FriendsInboxClient conversations={conversations} />

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
    </main>
  );
}
