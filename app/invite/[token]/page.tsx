import InviteAcceptClient from "@/components/InviteAcceptClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteAcceptClient token={token} />;
}
