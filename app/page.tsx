import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EmailWall from "@/components/EmailWall";
import { verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  console.log("ROOT TOKEN EXISTS:", Boolean(token));
  console.log("ROOT SESSION:", session);

  if (session?.email) {
    redirect("/home");
  }

  return (
    <main className="iphone-shell lock-screen">
      <EmailWall />
    </main>
  );
}
