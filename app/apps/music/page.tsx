import MusicLibraryClient from "@/components/MusicLibraryClient";
import { requireCurrentAppUser } from "@/lib/users";

export default async function MusicPage() {
  const user = await requireCurrentAppUser();
  return <MusicLibraryClient userId={user.id} />;
}
