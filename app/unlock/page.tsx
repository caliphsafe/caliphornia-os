import ShareUnlockClient from "@/components/share/ShareUnlockClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>;
}) {
  const params = await searchParams;
  return <ShareUnlockClient shareToken={params.share || ""} />;
}
