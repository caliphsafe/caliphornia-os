import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EmailWall from "@/components/EmailWall";
import { verifySession } from "@/lib/session";

export default async function Page() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (session) {
    redirect("/home");
  }

  return (
    <main className="iphone-shell lock-screen">
      <EmailWall />
    </main>
  );
}
