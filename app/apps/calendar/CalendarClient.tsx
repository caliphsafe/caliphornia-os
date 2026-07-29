"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type CalendarCell = { key: string; date: Date | null; day: number | null };
type AccessStatus = {
  ok: boolean;
  signedIn: boolean;
  hasKiikuPass: boolean;
  hasProjectAccess: boolean;
  hasAllAccess?: boolean;
  hasMusicFull?: boolean;
  isFounder?: boolean;
  projectAccess?: string[];
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

const LEGEND_ITEMS = ["song", "album", "game", "merch", "video", "access"].map((type) => ({
  type,
  label: TYPE_LABELS[type],
}));

function pad(value: number) { return String(value).padStart(2, "0"); }
function getDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function formatMonthName(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "long" }).format(value); }
function formatMonthYear(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }
function formatFullDate(value: string) { return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(value)); }
function projectName(slug?: string | null) { return slug ? PROJECT_NAMES[slug] || slug : "Caliphornia OS"; }
function typeLabel(type?: string | null) { return type ? TYPE_LABELS[type] || type : "Release"; }
function markerClass(type?: string | null) {
  const clean = String(type || "release").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `is-${clean || "release"}`;
}
function buildMonthCells(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push({ key: `empty-${year}-${month}-${i}`, date: null, day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ key: getDateKey(date), date, day });
  }
  return cells;
}
function isAvailableNow(event: CalendarEvent) { return new Date(event.starts_at).getTime() <= Date.now(); }
function getReleaseStatus(event: CalendarEvent) { return isAvailableNow(event) ? "Available Now" : "Coming Soon"; }
function getAccessInfo(event: CalendarEvent, accessStatus: AccessStatus | null) {
  const level = String(event.access_level || "free").toLowerCase();
  const projectSlug = String(event.project_slug || "").toLowerCase();
  const hasKiikuPass = Boolean(accessStatus?.hasKiikuPass);
  const ownedProjects = accessStatus?.projectAccess || [];
  const ownsProject = Boolean(projectSlug && ownedProjects.includes(projectSlug));
  if (level === "free") return { label: "Free", tone: "free", copy: "This drop is open to all listeners." };
  if (level === "kiiku_pass") return hasKiikuPass ? { label: "Included with Kiiku Pass", tone: "included", copy: "Your Kiiku Pass includes this release." } : { label: "Kiiku Pass", tone: "locked", copy: "Kiiku Pass unlocks this release across Caliphornia OS." };
  if (level === "album") {
    if (hasKiikuPass) return { label: "Included with Kiiku Pass", tone: "included", copy: "Your Kiiku Pass includes the full album experience." };
    if (ownsProject) return { label: "Album Unlocked", tone: "included", copy: `Your ${projectName(projectSlug)} unlock includes this release.` };
    return { label: "Album Unlock", tone: "locked", copy: `Unlock ${projectName(projectSlug)} to access the full release.` };
  }
  return { label: "Caliphornia OS", tone: "free", copy: "This release is part of the Caliphornia OS schedule." };
}
function getEventAction(event: CalendarEvent, accessStatus: AccessStatus | null) {
  if (!event.href) return null;
  if (!isAvailableNow(event)) return "View App";
  if (getAccessInfo(event, accessStatus).tone === "locked") return "Preview";
  return "Open Now";
}

export default function CalendarClient({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  const monthSections = useMemo(() => [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)], []);
  const eventsByDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((acc, event) => { const key = getDateKey(event.starts_at); acc[key] = acc[key] || []; acc[key].push(event); return acc; }, {}), [events]);
  const selectedEvents = selectedDateKey ? eventsByDate[selectedDateKey] || [] : [];
  const selectedDateLabel = selectedEvents[0]?.starts_at && selectedDateKey ? formatFullDate(selectedEvents[0].starts_at) : "";

  useEffect(() => {
    let active = true;
    async function loadAccessStatus() {
      try {
        const res = await fetch("/api/access/me?projectSlug=calendar", { cache: "no-store" });
        const data = await res.json();
        if (active) setAccessStatus(data);
      } catch { if (active) setAccessStatus(null); }
    }
    loadAccessStatus();
    return () => { active = false; };
  }, []);

  function openToday() {
    if (eventsByDate[todayKey]?.length) { setSelectedDateKey(todayKey); return; }
    const nextEvent = events[0];
    if (nextEvent) setSelectedDateKey(getDateKey(nextEvent.starts_at));
  }

  return (
    <main className="apple-cal-app">
      <section className="apple-cal-screen">
        <header className="apple-cal-topbar">
          <Link href="/home" className="apple-cal-year-pill"><span>‹</span>{now.getFullYear()}</Link>
          <div className="apple-cal-control-pill">
            <Link href="/apps/account" className="apple-cal-icon-button" aria-label="Account">◎</Link>
            <button type="button" className="apple-cal-icon-button" aria-label="Search calendar" onClick={openToday}><span className="apple-cal-search-symbol">⌕</span></button>
            <Link href="/apps/share" className="apple-cal-icon-button apple-cal-plus" aria-label="Share">+</Link>
          </div>
        </header>

        <section className="apple-cal-legend" aria-label="Release type legend">
          {LEGEND_ITEMS.map((item) => <span key={item.type}><i className={`apple-cal-marker ${markerClass(item.type)}`} />{item.label}</span>)}
        </section>

        <section className="apple-cal-month-scroll">
          {monthSections.map((monthDate, monthIndex) => {
            const cells = buildMonthCells(monthDate);
            const isCurrentMonth = monthIndex === 0;
            return (
              <section className={`apple-cal-month ${isCurrentMonth ? "is-current-month" : "is-next-month"}`} key={formatMonthYear(monthDate)}>
                {isCurrentMonth ? <h1>{formatMonthName(monthDate)}</h1> : <h2>{formatMonthName(monthDate).slice(0, 3)}</h2>}
                {isCurrentMonth ? <div className="apple-cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div> : null}
                <div className="apple-cal-grid">
                  {cells.map((cell) => {
                    const dayEvents = cell.day ? eventsByDate[cell.key] || [] : [];
                    const isToday = cell.key === todayKey;
                    const isWeekend = cell.date?.getDay() === 0 || cell.date?.getDay() === 6;
                    const hasEvents = dayEvents.length > 0;
                    const className = ["apple-cal-day", isToday ? "is-today" : "", isWeekend ? "is-weekend" : "", hasEvents ? "has-events" : "", selectedDateKey === cell.key ? "is-selected" : ""].filter(Boolean).join(" ");
                    if (!cell.day) return <div key={cell.key} className={className} />;
                    return (
                      <button key={cell.key} type="button" className={className} disabled={!hasEvents} onClick={() => hasEvents && setSelectedDateKey(cell.key)} aria-label={hasEvents ? `Open releases for ${formatMonthName(cell.date as Date)} ${cell.day}` : `${formatMonthName(cell.date as Date)} ${cell.day}`}>
                        <span>{cell.day}</span>
                        {hasEvents ? <div className={`apple-cal-markers ${dayEvents.length > 1 ? "has-multiple" : ""}`}>{dayEvents.slice(0, 3).map((event) => <i key={event.id} className={`apple-cal-marker ${markerClass(event.event_type)}`} />)}</div> : null}
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
            <div className="apple-cal-sheet-head"><div><p>Release Details</p><h3>{selectedDateLabel}</h3></div><button type="button" aria-label="Close release details" onClick={() => setSelectedDateKey(null)}>×</button></div>
            <div className="apple-cal-sheet-list">
              {selectedEvents.map((event) => {
                const releaseStatus = getReleaseStatus(event);
                const accessInfo = getAccessInfo(event, accessStatus);
                const actionLabel = getEventAction(event, accessStatus);
                return (
                  <article className="apple-cal-sheet-event" key={event.id}>
                    <div className="apple-cal-sheet-event-top">
                      <div><div className="apple-cal-status-line"><span className={`apple-cal-status-pill ${releaseStatus === "Available Now" ? "is-available" : "is-coming"}`}>{releaseStatus}</span><span className={`apple-cal-access-pill is-${accessInfo.tone}`}>{accessInfo.label}</span></div><p>{typeLabel(event.event_type)}</p><h4>{event.title}</h4></div>
                      <i className={`apple-cal-sheet-dot ${markerClass(event.event_type)}`} />
                    </div>
                    <p className="apple-cal-sheet-desc">{event.description || "A scheduled Caliphornia OS drop."}</p>
                    <p className="apple-cal-sheet-access-copy">{accessInfo.copy}</p>
                    <div className="apple-cal-sheet-meta"><span>{projectName(event.project_slug)}</span><span>{formatShortDate(event.starts_at)}</span><span>{typeLabel(event.event_type)}</span></div>
                    {event.href && actionLabel ? <Link href={event.href} className="apple-cal-sheet-link">{actionLabel}</Link> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="apple-cal-floating-actions">
          <button type="button" className="apple-cal-today-button" onClick={openToday}>Today</button>
          <div className="apple-cal-bottom-pill"><span>!</span><span className="apple-cal-inbox-icon">▱</span><strong>{events.length}</strong></div>
        </div>
      </section>
    </main>
  );
}
