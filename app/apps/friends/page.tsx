import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";

async function getConversation() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedBase = base.startsWith("http") ? base : `https://${base}`;

  const res = await fetch(
    `${normalizedBase}/api/apps/friends/conversations/vote4predro`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function FriendsPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  const data = await getConversation();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#08111d",
        color: "white",
        padding: "24px 16px 120px"
      }}
    >
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <a
          href="/home"
          style={{
            display: "inline-flex",
            marginBottom: 18,
            color: "rgba(255,255,255,0.8)",
            textDecoration: "none"
          }}
        >
          ← Back
        </a>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: 18,
            backdropFilter: "blur(18px)"
          }}
        >
          <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>frie.ends</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.68)" }}>
            {data?.conversation?.title || "Conversation"}
          </p>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.54)" }}>
            {data?.conversation?.subtitle || ""}
          </p>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {(data?.messages || []).map((msg: any) => {
            if (msg.message_type === "timestamp" || msg.message_type === "system") {
              return (
                <div
                  key={msg.id}
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    padding: "8px 0"
                  }}
                >
                  {msg.body}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  maxWidth: "82%",
                  padding: "12px 14px",
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)"
                }}
              >
                {msg.sender_label ? (
                  <div
                    style={{
                      fontSize: 12,
                      marginBottom: 6,
                      color: "rgba(255,255,255,0.56)"
                    }}
                  >
                    {msg.sender_label}
                  </div>
                ) : null}

                <div style={{ lineHeight: 1.45 }}>{msg.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
