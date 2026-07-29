import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { readSession } from "@/lib/session";
import { getCurrentAppUser, getOrCreateAppUser } from "@/lib/users";

export default async function HomePage() {
  const session = await readSession();

  if (!session?.email) {
    redirect("/");
  }

  const existingUser = await getCurrentAppUser();
  const user =
    existingUser ||
    (await getOrCreateAppUser(session.email, session.username || null));

  return <HomeScreen user={user} />;
}
