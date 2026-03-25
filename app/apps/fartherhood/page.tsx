import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import FartherhoodEmbed from "@/components/FartherhoodEmbed";

export default async function FartherhoodPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  return <FartherhoodEmbed />;
}
