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

type CalendarCell = {
  key: string;
  date: Date | null;
  day: number | null;
};

const PROJECT_NAMES: Record<string, string> = {
  friends: "Fri.ends",
  fartherhood: "FarTHErHOOD",
  fatherhood: "FarTHErHOOD",
  milia: "Milia",
  music: "Music",
  calendar: "Calendar",
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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthName(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(value);
}

function formatMonthYear(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
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

function markerClass(type?: string | null) {
  const clean = String(type || "release")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

  return `is-${clean || "release"}`;
}

function buildMonthCells(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({
      key: `empty-${year}-${month}-${i}`,
      date: null,
      day: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);

    cells.push({
      key: getDateKey(date),
      date,
      day,
    });
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

  const monthSections = [
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ];

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
  const upcomingEvents = events.slice(0, 10);

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = getDateKey(event.starts_at);
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});

  return (
    <main className="apple-cal-app">
      <section className="apple-cal-screen">
        <header className="apple-cal-topbar">
          <Link href="/home" className="apple-cal-year-pill">
            <span>‹</span>
            {now.getFullYear()}
          </Link>

          <div className="apple-cal-control-pill">
            <AccessWindow
              projectSlug="calendar"
              projectName="Calendar"
              triggerClassName="apple-cal-icon-button apple-cal-access-button"
              triggerImgClassName="apple-cal-access-icon"
            />

            <button type="button" className="apple-cal-icon-button" aria-label="Search">
              <span className="apple-cal-search-symbol">⌕</span>
            </button>

            <button type="button" className="apple-cal-icon-button apple-cal-plus" aria-label="Add">
              +
            </button>
          </div>
        </header>

        <section className="apple-cal-month-scroll">
          {monthSections.map((monthDate, monthIndex) => {
            const cells = buildMonthCells(monthDate);
            const isCurrentMonth = monthIndex === 0;

            return (
              <section
                className={`apple-cal-month ${isCurrentMonth ? "is-current-month" : "is-next-month"}`}
                key={formatMonthYear(monthDate)}
              >
                {isCurrentMonth ? (
                  <h1>{formatMonthName(monthDate)}</h1>
                ) : (
                  <h2>{formatMonthName(monthDate).slice(0, 3)}</h2>
                )}

                {isCurrentMonth ? (
                  <div className="apple-cal-weekdays">
                    <span>S</span>
                    <span>M</span>
                    <span>T</span>
                    <span>W</span>
                    <span>T</span>
                    <span>F</span>
                    <span>S</span>
                  </div>
                ) : null}

                <div className="apple-cal-grid">
                  {cells.map((cell) => {
                    const dayEvents = cell.day ? eventsByDate[cell.key] || [] : [];
                    const isToday = cell.key === todayKey;
                    const isWeekend =
                      cell.date?.getDay() === 0 || cell.date?.getDay() === 6;

                    return (
                      <div
                        key={cell.key}
                        className={[
                          "apple-cal-day",
                          isToday ? "is-today" : "",
                          isWeekend ? "is-weekend" : "",
                          dayEvents.length ? "has-events" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {cell.day ? <span>{cell.day}</span> : null}

                        {dayEvents.length ? (
                          <div
                            className={`apple-cal-markers ${
                              dayEvents.length > 1 ? "has-multiple" : ""
                            }`}
                          >
                            {dayEvents.slice(0, 3).map((event) => (
                              <i
                                key={event.id}
                                className={`apple-cal-marker ${markerClass(event.event_type)}`}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        <section className="apple-cal-agenda">
          <div className="apple-cal-agenda-head">
            <div>
              <p>Upcoming</p>
              <h3>Release Schedule</h3>
            </div>
          </div>

          {upcomingEvents.length ? (
            <div className="apple-cal-agenda-list">
              {upcomingEvents.map((event) => (
                <article className="apple-cal-agenda-row" key={event.id}>
                  <div className="apple-cal-agenda-date">
                    <strong>{new Date(event.starts_at).getDate()}</strong>
                    <span>{formatShortDate(event.starts_at).split(" ")[0]}</span>
                  </div>

                  <div className="apple-cal-agenda-copy">
                    <div className="apple-cal-agenda-title">
                      <h4>{event.title}</h4>
                      <span>{typeLabel(event.event_type)}</span>
                    </div>

                    <p>{event.description || "A scheduled Caliphornia OS drop."}</p>

                    <div className="apple-cal-agenda-meta">
                      <small>{formatFullDate(event.starts_at)}</small>
                      <small>{projectName(event.project_slug)}</small>
                      <small>{accessLabel(event.access_level)}</small>
                    </div>
                  </div>

                  {event.href ? (
                    <Link href={event.href} className="apple-cal-open-link">
                      Open
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="apple-cal-empty">
              <h4>No upcoming drops yet</h4>
              <p>Add release dates in Supabase and they will appear here automatically.</p>
            </div>
          )}
        </section>

        <div className="apple-cal-floating-actions">
          <Link href="/apps/calendar" className="apple-cal-today-button">
            Today
          </Link>

          <div className="apple-cal-bottom-pill">
            <span>!</span>
            <span className="apple-cal-inbox-icon">▱</span>
            <strong>{upcomingEvents.length}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
