import EmailWall from "@/components/EmailWall";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await readSession();
  if (session?.email) redirect("/home");
  return <EmailWall />;
}
