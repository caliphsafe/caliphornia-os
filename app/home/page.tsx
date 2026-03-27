import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { verifySession } from "@/lib/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  if (!session) {
    redirect("/");
  }

  return <HomeScreen
  email={session.email}
  username={session.username}
/>;
}
