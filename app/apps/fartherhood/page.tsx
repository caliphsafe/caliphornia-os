import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";

export default async function FartherhoodPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  return (
    <main className="embedded-app-shell">
      <iframe
        src="/apps/fartherhood/index.html"
        title="FarTHERHOOD"
        className="embedded-app-frame"
      />
    </main>
  );
}
