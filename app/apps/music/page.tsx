import MusicLibraryClient from "@/components/MusicLibraryClient";
import { requireCurrentAppUser } from "@/lib/users";
import "./music.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MusicPage() {
  const user = await requireCurrentAppUser();
  return <MusicLibraryClient userId={user.id} />;
}
