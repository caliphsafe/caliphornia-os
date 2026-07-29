import "../friends.css";
import FriendsThreadLoader from "@/components/FriendsThreadLoader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FriendsThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <FriendsThreadLoader slug={slug} />;
}
