import GuestPlayer from "@/components/guest/GuestPlayer";
export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestPlayer token={token} />;
}
