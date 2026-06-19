import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import CalendarClient, { type CalendarEvent } from "./CalendarClient";
import "./calendar.css";

export default async function CalendarAppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const now = new Date();

  const eventsRes = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, title, event_type, project_slug, description, starts_at, ends_at, href, access_level, is_featured, is_published"
    )
    .eq("is_published", true)
    .gte("starts_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(120);

  const events = (eventsRes.data || []) as CalendarEvent[];

  return <CalendarClient events={events} />;
}
