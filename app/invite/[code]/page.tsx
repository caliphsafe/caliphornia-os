import InviteClaimClient from "@/components/invite/InviteClaimClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <InviteClaimClient code={code} />;
}
