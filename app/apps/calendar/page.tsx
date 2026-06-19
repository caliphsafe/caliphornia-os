import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AccessWindow from "@/components/AccessWindow";
import { verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import "./calendar.css";

type CalendarEvent = {
  id: string;
  title: string;
  event_type: string;
  project_slug: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  href: string | null;
  access_level: string;
  is_featured: boolean;
  is_published: boolean;
};

const PROJECT_NAMES: Record<string, string> = {
  friends: "Fri.ends",
  fartherhood: "FarTHErHOOD",
  fatherhood: "FarTHErHOOD",
  milia: "Milia",
  music: "Music",
};

const TYPE_LABELS: Record<string, string> = {
  song: "Song",
  album: "Album",
  game: "Game",
  merch: "Merch",
  video: "Video",
  app: "App",
  live: "Live",
  access: "Access",
  release: "Release",
};

function getDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function getDayNumber(value: string) {
  return new Date(value).getDate();
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function projectName(slug?: string | null) {
  if (!slug) return "Caliphornia OS";
  return PROJECT_NAMES[slug] || slug;
}

function typeLabel(type?: string | null) {
  if (!type) return "Release";
  return TYPE_LABELS[type] || type;
}

function accessLabel(level?: string | null) {
  if (level === "kiiku_pass") return "Kiiku Pass";
  if (level === "album") return "Album Unlock";
  return "Free";
}

function buildMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; key: string }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, key: `empty-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ day, key: getDateKey(date) });
  }

  return cells;
}

export default async function CalendarAppPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("caliph_os_session")?.value ?? null;
  const session = verifySession(token);

  if (!session?.email) {
    redirect("/");
  }

  const now = new Date();
  const todayKey = getDateKey(now);

  const eventsRes = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, title, event_type, project_slug, description, starts_at, ends_at, href, access_level, is_featured, is_published"
    )
    .eq("is_published", true)
    .gte("starts_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(80);

  const events = (eventsRes.data || []) as CalendarEvent[];
  const featuredEvent = events.find((event) => event.is_featured) || events[0] || null;
  const upcomingEvents = events.slice(0, 12);
  const monthDays = buildMonthDays(now);

  const eventCountByDay = events.reduce<Record<string, number>>((acc, event) => {
    const key = getDateKey(event.starts_at);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="cal-app-shell">
      <section className="cal-screen">
        <header className="cal-topbar">
          <Link href="/home" className="cal-back-link">
            Home
          </Link>

          <div className="cal-title-block">
            <p>Caliphornia OS</p>
            <h1>Calendar</h1>
          </div>

          <AccessWindow
            projectSlug="calendar"
            projectName="Calendar"
            triggerClassName="cal-access-button"
            triggerImgClassName="cal-access-icon"
          />
        </header>

        <section className="cal-hero">
          <div className="cal-date-card">
            <span>
              {new Intl.DateTimeFormat("en-US", { month: "short" }).format(now)}
            </span>
            <strong>{now.getDate()}</strong>
          </div>

          <div className="cal-hero-copy">
            <p className="cal-kicker">Release map</p>
            <h2>What’s coming next</h2>
            <p>
              Track songs, album experiences, games, videos, merch drops, and
              Caliphornia OS updates in one place.
            </p>
          </div>
        </section>

        {featuredEvent ? (
          <section className="cal-featured-card">
            <div>
              <p className="cal-kicker">Featured drop</p>
              <h3>{featuredEvent.title}</h3>
              <p>{featuredEvent.description || "A new Caliphornia OS release is on the way."}</p>

              <div className="cal-meta-row">
                <span>{formatFullDate(featuredEvent.starts_at)}</span>
                <span>{typeLabel(featuredEvent.event_type)}</span>
                <span>{accessLabel(featuredEvent.access_level)}</span>
              </div>
            </div>

            {featuredEvent.href ? (
              <Link href={featuredEvent.href} className="cal-open-button">
                Open
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="cal-month-card">
          <div className="cal-section-head">
            <div>
              <p className="cal-kicker">Month view</p>
              <h3>{formatMonth(now)}</h3>
            </div>
          </div>

          <div className="cal-weekdays">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          <div className="cal-grid">
            {monthDays.map((cell) => {
              const isToday = cell.key === todayKey;
              const hasEvents = cell.day ? Boolean(eventCountByDay[cell.key]) : false;

              return (
                <div
                  key={cell.key}
                  className={`cal-day ${isToday ? "is-today" : ""} ${
                    hasEvents ? "has-event" : ""
                  }`}
                >
                  {cell.day ? <span>{cell.day}</span> : null}
                  {hasEvents ? <i /> : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="cal-events-card">
          <div className="cal-section-head">
            <div>
              <p className="cal-kicker">Upcoming</p>
              <h3>Release schedule</h3>
            </div>
          </div>

          {upcomingEvents.length ? (
            <div className="cal-event-list">
              {upcomingEvents.map((event) => (
                <article key={event.id} className="cal-event-row">
                  <div className="cal-event-date">
                    <strong>{getDayNumber(event.starts_at)}</strong>
                    <span>{formatShortDate(event.starts_at).split(" ")[0]}</span>
                  </div>

                  <div className="cal-event-main">
                    <div className="cal-event-title-row">
                      <h4>{event.title}</h4>
                      <span>{typeLabel(event.event_type)}</span>
                    </div>

                    <p>{event.description || "A scheduled Caliphornia OS drop."}</p>

                    <div className="cal-event-tags">
                      <small>{projectName(event.project_slug)}</small>
                      <small>{accessLabel(event.access_level)}</small>
                    </div>
                  </div>

                  {event.href ? (
                    <Link href={event.href} className="cal-event-link">
                      Open
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="cal-empty-state">
              <h4>No upcoming drops yet</h4>
              <p>
                Add release dates in Supabase and they will appear here
                automatically.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
