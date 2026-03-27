import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeScreen from "@/components/HomeScreen";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;

  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("email, username, role")
    .eq("email", session.email)
    .limit(1);

  let username = "";
  let role = "user";

  if (!error && data && data.length > 0) {
    username = data[0].username || "";
    role = data[0].role || "user";
  }

  return (
    <HomeScreen
      email={session.email}
      username={username}
      role={role}
    />
  );
}
