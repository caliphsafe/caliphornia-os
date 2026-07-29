import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import ShareClient from "@/components/share/ShareClient";
import "./share.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SharePage() {
  const session = await readSession();
  if (!session?.email) redirect("/");
  return <ShareClient />;
}
