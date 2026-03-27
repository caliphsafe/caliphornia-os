import "./dash.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const { data: userRow, error } = await supabaseAdmin
    .from("app_users")
    .select("role")
    .eq("email", session.email)
    .maybeSingle();

  if (error || !userRow || userRow.role !== "admin") {
    redirect("/home");
  }

  return <div className="dashboard-root">{children}</div>;
}
