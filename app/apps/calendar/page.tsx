import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import CalendarClient, { type CalendarEvent } from "./CalendarClient";
import "./calendar.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalendarAppPage() {
  const session = await readSession();
  if (!session?.email) redirect("/");

  const now = new Date();
  const eventsRes = await supabaseAdmin
    .from("calendar_events")
    .select("id, title, event_type, project_slug, description, starts_at, ends_at, href, access_level, is_featured, is_published")
    .eq("is_published", true)
    .gte("starts_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(120);

  const events = (eventsRes.data || []) as CalendarEvent[];
  return <CalendarClient events={events} />;
}
