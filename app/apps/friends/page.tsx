import "./friends.css";
import FriendsInboxLoader from "@/components/FriendsInboxLoader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FriendsPage() {
  return <FriendsInboxLoader />;
}
