import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const { data: userRow } = await supabaseAdmin
    .from("app_users")
    .select("username")
    .eq("email", session.email)
    .maybeSingle();

  return (
    <HomeScreen
      email={session.email}
      username={userRow?.username || ""}
    />
  );
}
