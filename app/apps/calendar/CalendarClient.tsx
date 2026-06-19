"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AccessWindow from "@/components/AccessWindow";

export type CalendarEvent = {
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

export default function CalendarClient({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const todayKey = getDateKey(now);

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const monthSections = useMemo(
    () => [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 1),
    ],
    []
  );

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = getDateKey(event.starts_at);
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [events]);

  const selectedEvents = selectedDateKey ? eventsByDate[selectedDateKey] || [] : [];

  const selectedDateLabel =
    selectedEvents[0]?.starts_at && selectedDateKey
      ? formatFullDate(selectedEvents[0].starts_at)
      : "";

  function openToday() {
    if (eventsByDate[todayKey]?.length) {
      setSelectedDateKey(todayKey);
      return;
    }

    const nextEvent = events[0];
    if (nextEvent) {
      setSelectedDateKey(getDateKey(nextEvent.starts_at));
    }
  }

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
                    const hasEvents = dayEvents.length > 0;

                    const className = [
                      "apple-cal-day",
                      isToday ? "is-today" : "",
                      isWeekend ? "is-weekend" : "",
                      hasEvents ? "has-events" : "",
                      selectedDateKey === cell.key ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    if (!cell.day) {
                      return <div key={cell.key} className={className} />;
                    }

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        className={className}
                        disabled={!hasEvents}
                        onClick={() => {
                          if (hasEvents) {
                            setSelectedDateKey(cell.key);
                          }
                        }}
                        aria-label={
                          hasEvents
                            ? `Open events for ${formatMonthName(cell.date as Date)} ${cell.day}`
                            : `${formatMonthName(cell.date as Date)} ${cell.day}`
                        }
                      >
                        <span>{cell.day}</span>

                        {hasEvents ? (
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
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        {selectedEvents.length ? (
          <section className="apple-cal-event-sheet" aria-label="Selected release details">
            <div className="apple-cal-sheet-handle" />

            <div className="apple-cal-sheet-head">
              <div>
                <p>Release Details</p>
                <h3>{selectedDateLabel}</h3>
              </div>

              <button
                type="button"
                aria-label="Close release details"
                onClick={() => setSelectedDateKey(null)}
              >
                ×
              </button>
            </div>

            <div className="apple-cal-sheet-list">
              {selectedEvents.map((event) => (
                <article className="apple-cal-sheet-event" key={event.id}>
                  <div className="apple-cal-sheet-event-top">
                    <div>
                      <p>{typeLabel(event.event_type)}</p>
                      <h4>{event.title}</h4>
                    </div>

                    <i className={`apple-cal-sheet-dot ${markerClass(event.event_type)}`} />
                  </div>

                  <p className="apple-cal-sheet-desc">
                    {event.description || "A scheduled Caliphornia OS drop."}
                  </p>

                  <div className="apple-cal-sheet-meta">
                    <span>{projectName(event.project_slug)}</span>
                    <span>{accessLabel(event.access_level)}</span>
                    <span>{formatShortDate(event.starts_at)}</span>
                  </div>

                  {event.href ? (
                    <Link href={event.href} className="apple-cal-sheet-link">
                      Open Release
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="apple-cal-floating-actions">
          <button type="button" className="apple-cal-today-button" onClick={openToday}>
            Today
          </button>

          <div className="apple-cal-bottom-pill">
            <span>!</span>
            <span className="apple-cal-inbox-icon">▱</span>
            <strong>{events.length}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
