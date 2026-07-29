import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { readSession } from "@/lib/session";
import { getCurrentAppUser, getOrCreateAppUser } from "@/lib/users";
import type { AppUser } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await readSession();

  if (!session?.email) {
    redirect("/");
  }

  let user: AppUser = {
    id: "session-user",
    email: session.email,
    username: session.username || session.email.split("@")[0],
    role: session.role || "user",
  };

  try {
    const existingUser = await getCurrentAppUser();

    if (existingUser?.id) {
      user = existingUser;
    } else {
      user = await getOrCreateAppUser(session.email, session.username || null);
    }
  } catch (error) {
    console.error("HOME_USER_LOOKUP_FAILED", error);
  }

  return <HomeScreen user={user} />;
}
