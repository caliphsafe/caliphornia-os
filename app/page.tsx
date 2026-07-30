import EmailWall from "@/components/EmailWall";
import ProximityReceivePrompt from "@/components/share/ProximityReceivePrompt";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await readSession();
  if (session?.email) redirect("/home");

  return (
    <>
      <EmailWall />
      <ProximityReceivePrompt />
    </>
  );
}
