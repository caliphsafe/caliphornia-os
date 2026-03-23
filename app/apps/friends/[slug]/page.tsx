import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";

async function getConversation(slug: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;

  const res = await fetch(
    `${normalizedBase}/api/apps/friends/conversations/${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function FriendsConversationPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  const data = await getConversation(slug);

  if (!data?.ok || !data?.conversation) {
    redirect("/apps/friends");
  }

  const conversation = data.conversation;
  const messages = data.messages || [];

  return (
    <main className="friends-thread-screen">
      <div className="friends-thread-shell">
        <div className="friends-thread-header">
          <a href="/apps/friends" className="friends-thread-back">
            ‹ Fri.ends
          </a>

          <div className="friends-thread-center">
            <div className="friends-thread-avatar">
              {conversation.avatar_letter || conversation.title?.[0] || "V"}
            </div>

            <div className="friends-thread-meta">
              <div className="friends-thread-title">{conversation.title}</div>
              <div className="friends-thread-subtitle">
                {conversation.subtitle || ""}
              </div>
            </div>
          </div>

          <div className="friends-thread-actions">
            <button className="friends-thread-action">⌄</button>
            <button className="friends-thread-action">◻︎</button>
          </div>
        </div>

        <div className="friends-thread-messages">
          {messages.map((msg: any) => {
            if (msg.message_type === "timestamp" || msg.message_type === "system" || msg.message_side === "center") {
              return (
                <div key={msg.id} className="friends-center-line">
                  {msg.body}
                </div>
              );
            }

            const side = msg.message_side === "outgoing" ? "outgoing" : "incoming";

            return (
              <div key={msg.id} className={`friends-message-block ${side}`}>
                {msg.sender_label && side === "incoming" ? (
                  <div className="friends-sender-label">{msg.sender_label}</div>
                ) : null}

                <div className={`friends-bubble ${side}`}>
                  {msg.body}
                </div>
              </div>
            );
          })}
        </div>

        <div className="friends-thread-inputbar">
          <button className="friends-plus-btn">＋</button>

          <div className="friends-input-pill">
            <span className="friends-input-placeholder">iMessage</span>
            <span className="friends-input-mic">◖</span>
          </div>
        </div>
      </div>
    </main>
  );
}
