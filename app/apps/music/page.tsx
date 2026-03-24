import "@app/styles/music.css";
import MusicLibraryClient from "@/components/MusicLibraryClient";

export default async function MusicPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = params.email || "";

  return <MusicLibraryClient email={email} />;
}
