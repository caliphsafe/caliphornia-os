import MusicLibraryClient from "@/components/MusicLibraryClient";
import "./music-app.css";
import { requireCurrentAppUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MusicPage() {
  const user = await requireCurrentAppUser();
  return <MusicLibraryClient userId={user.id} email={user.email} />;
}
