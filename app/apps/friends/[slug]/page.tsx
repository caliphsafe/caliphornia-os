import "../friends.css";import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import FriendsThreadClient from "@/components/FriendsThreadClient";

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

  return (
    <FriendsThreadClient
      conversation={data.conversation}
      messages={data.messages || []}
    />
  );
}
