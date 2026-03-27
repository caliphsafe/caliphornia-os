import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;

  const session = verifySession(token);

  //  No session → back to lock screen
  if (!session?.email) {
    redirect("/");
  }

  //  Always fetch fresh user from DB
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("email, username")
    .eq("email", session.email)
    .limit(1);

  let username = "";

  if (!error && data && data.length > 0) {
    username = data[0].username || "";
  }

  return (
    <HomeScreen
      email={session.email}
      username={username}
    />
  );
}
