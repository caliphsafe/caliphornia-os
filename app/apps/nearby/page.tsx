import NearbyClient from "@/components/nearby/NearbyClient";
import { getCurrentAppUser } from "@/lib/users";

export default async function NearbyPage() {
  const user = await getCurrentAppUser();
  return <NearbyClient signedIn={Boolean(user)} />;
}
