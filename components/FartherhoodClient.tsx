"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Track = {
  id?: string | null;
  slug: string;
  title: string;
  date: string;
  duration: string;
  file: string;
  transcript: string;
  description: string;
};

type NoteItem = {
  display_name?: string | null;
  note_body?: string | null;
  created_at?: string | null;
};

const defaultTracks: Track[] = [
  {
    slug: "story-time",
    title: "CALIPH - STORY TIME",
    date: "Feb 28, 2025 at 12:40 AM",
    duration: "02:07",
    file: "/apps/fartherhood/audio/storytime.mp3",
    transcript: `(Little little place between the oh) 
Let's switch the conversation up a bit
Niggas ain't sayin' shit and I had enough of it
I don't give a fuck what you saying I'm hustlin'
So why you at a war with your image cause peace (piece) is puzzlin,
And niggas like you love to talk down on a nigga lookin' like me
Cause I walk down on a nigga do do do do
Now he less than likely to be mmm hmm hmm hmmm
he more Mmm mm mmm mmm
Now what would you say if a nigga like me was your father?
Made you out your grandmothers daughter
6th man, wasn't good enough to be a starter
But somehow I'm the one that turned her to a mama`,
    description:
      "Song about the accidental conception of a child in the black community"
  },
  {
    slug: "eater-james",
    title: "CALIPH - EATER JAMES",
    date: "Feb 28, 2025 at 12:45 AM",
    duration: "02:00",
    file: "/apps/fartherhood/audio/eaterjames.mp3",
    transcript: `All right, okay, all right…
(All right, okay, all right…)
go, go, okay, right, go…`,
    description:
      "A song about secret black love that leads to a bad relationship, failed coparenting"
  },
  {
    slug: "blue-corner",
    title: "CALIPH - BLUE CORNER",
    date: "Feb 13, 2025 at 5:03 PM",
    duration: "02:00",
    file: "/apps/fartherhood/audio/bluecorner.mp3",
    transcript: `The streets talking…
I could care less where I'm from…
we find peace in comparing Nike Air…`,
    description: "A song about a tragedy as a result of failed co parenting."
  },
  {
    slug: "observations-dollar-and-a-dad",
    title: "CALIPH - OBESERVATIONS / A DOLLAR AND A DAD",
    date: "Feb 28, 2025 at 12:55 AM",
    duration: "02:00",
    file: "/apps/fartherhood/audio/dollardad.mp3",
    transcript: `Conversations switchin up…
niggas always act weird when it's time to give it up…`,
    description: "Crackhead dad encounters his son and opens up."
  },
  {
    slug: "seeds",
    title: "CALIPH - SEEDS",
    date: "Feb 28, 2025 at 12:43 AM",
    duration: "02:00",
    file: "/apps/fartherhood/audio/seeds.mp3",
    transcript: `The world getting colder than ever…
it's getting harder to hold the dinero…`,
    description:
      "Outro about wanting kids but with fear of doing it with the wrong woman."
  }
];

function normalizeTrackFile(file: string | null | undefined) {
  if (!file) return "";
  if (file.startsWith("http://") || file.startsWith("https://")) return file;
  if (file.startsWith("/")) return file;
  return `/apps/fartherhood/${file.replace(/^\.?\//, "")}`;
}

function escapeHtml(str: string) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatModalDate(dateStr: string) {
  return String(dateStr || "")
    .replace("Jan ", "1/")
    .replace("Feb ", "2/")
    .replace("Mar ", "3/")
    .replace("Apr ", "4/")
    .replace("May ", "5/")
    .replace("Jun ", "6/")
    .replace("Jul ", "7/")
    .replace("Aug ", "8/")
    .replace("Sep ", "9/")
    .replace("Oct ", "10/")
    .replace("Nov ", "11/")
    .replace("Dec ", "12/")
    .replace(", 2025", "/25")
    .replace(" at ", ", ");
}

function formatTimer(seconds: number) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);

  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatNoteDate(dateStr?: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit"
    }).format(d);
  } catch {
    return "";
  }
}

export default function FartherhoodClient() {
  const router = useRouter();

  const [tracks, setTracks] = useState<Track[]>(defaultTracks);
  const [playerState, setPlayerState] = useState({
    slug: null as string | null,
    isPlaying: false,
    currentTime: 0,
    duration: 0
  });

  const [modalIndex, setModalIndex] = useState<number>(-1);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [reloadHint, setReloadHint] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabStyle, setCollabStyle] = useState<{ top?: number; left?: number }>({});
  const collabBtnRef = useRef<HTMLAnchorElement | null>(null);
  const collabPopoverRef = useRef<HTMLDivElement | null>(null);

  const modalTrack = modalIndex > -1 ? tracks[modalIndex] : null;

  useEffect(() => {
    async function loadTracksFromSupabase() {
      try {
        const res = await fetch("/api/apps/fartherhood/songs", { cache: "no-store" });
        const data = await res.json();

        if (!data.ok || !Array.isArray(data.tracks) || data.tracks.length === 0) {
          setTracks(defaultTracks);
          return;
        }

        const normalized = data.tracks.map((track: Partial<Track>, i: number) => ({
          id: track.id || null,
          slug: track.slug || defaultTracks[i]?.slug || `track-${i}`,
          title: track.title || defaultTracks[i]?.title || "",
          date: track.date || defaultTracks[i]?.date || "",
          duration: track.duration || defaultTracks[i]?.duration || "02:00",
          file: normalizeTrackFile(track.file || defaultTracks[i]?.file || ""),
          transcript: track.transcript || defaultTracks[i]?.transcript || "",
          description: track.description || defaultTracks[i]?.description || ""
        }));

        setTracks(normalized);
      } catch {
        setTracks(defaultTracks);
      }
    }

    void loadTracksFromSupabase();
  }, []);

  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await fetch("/api/apps/fartherhood/notes", { cache: "no-store" });
        const data = await res.json();

        if (!data.ok || !Array.isArray(data.notes)) {
          setNotes([]);
          return;
        }

        setNotes(data.notes);
      } catch {
        setNotes([]);
      }
    }

    void loadNotes();
    const interval = window.setInterval(loadNotes, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function onPlayerState(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "CALIPH_PLAYER_STATE") return;

      setPlayerState({
        slug: data.slug || null,
        isPlaying: Boolean(data.isPlaying),
        currentTime: Number(data.currentTime || 0),
        duration: Number(data.duration || 0)
      });
    }

    window.addEventListener("message", onPlayerState);
    return () => window.removeEventListener("message", onPlayerState);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!collabOpen) return;
      const target = e.target as Node;
      if (collabPopoverRef.current?.contains(target)) return;
      if (collabBtnRef.current?.contains(target)) return;
      setCollabOpen(false);
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCollabOpen(false);
      }
    }

    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("click", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [collabOpen]);

  function sendQueueToGlobal(startIndex: number, toggle = false) {
    window.postMessage(
      {
        type: toggle ? "CALIPH_PLAYER_TOGGLE_TRACK" : "CALIPH_PLAYER_LOAD_QUEUE",
        startIndex,
        tracks: tracks.map((track) => ({
          id: track.id || null,
          slug: track.slug,
          title: track.title,
          date: track.date,
          duration: track.duration,
          file: track.file,
          transcript: track.transcript,
          description: track.description,
          sourceApp: "fartherhood"
        }))
      },
      "*"
    );
  }

  function sendPlayerCommand(type: string, extra: Record<string, unknown> = {}) {
    window.postMessage({ type, ...extra }, "*");
  }

  function togglePlay(index: number) {
    const track = tracks[index];
    if (!track) return;

    const isSameTrack = playerState.slug === track.slug;

    if (isSameTrack) {
      sendPlayerCommand(playerState.isPlaying ? "CALIPH_PLAYER_PAUSE" : "CALIPH_PLAYER_PLAY");
      return;
    }

    sendQueueToGlobal(index, true);
  }

  function openTranscript(index: number) {
    setModalIndex(index);
    document.body.classList.add("modal-lock");
  }

  function closeTranscript() {
    setModalIndex(-1);
    document.body.classList.remove("modal-lock");
  }

  async function submitNote() {
    const displayName = noteName.trim();
    const noteBody = noteMessage.trim();

    if (!displayName || !noteBody) {
      alert("Please fill out both fields.");
      return;
    }

    try {
      const res = await fetch("/api/apps/fartherhood/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          noteBody
        })
      });

      const data = await res.json();

      if (!data.ok) {
        alert(data.error || "Could not submit note.");
        return;
      }

      setNoteName("");
      setNoteMessage("");
      setNoteOpen(false);
      setReloadHint("Note sent.");

      const notesRes = await fetch("/api/apps/fartherhood/notes", { cache: "no-store" });
      const notesData = await notesRes.json();
      if (notesData.ok && Array.isArray(notesData.notes)) {
        setNotes(notesData.notes);
      }
    } catch {
      alert("Could not submit note.");
    }
  }

  function toggleCollabPopover(e?: React.MouseEvent) {
    e?.preventDefault();

    if (!collabOpen && collabBtnRef.current) {
      const r = collabBtnRef.current.getBoundingClientRect();
      const popW = Math.min(360, window.innerWidth - 24);
      const top = Math.min(window.innerHeight - 20, r.bottom + 12);
      const left = Math.min(window.innerWidth - popW - 12, Math.max(12, r.right - popW));
      setCollabStyle({ top, left });
    }

    setCollabOpen((prev) => !prev);
  }

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();

    const shareData = {
      title: "FarTHErHOOD",
      text: "CALIPH — FarTHErHOOD",
      url: window.location.href
    };

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied. Paste it anywhere to share.");
    } catch {
      window.prompt("Copy this link to share:", window.location.href);
    }
  }

  function backHome(e: React.MouseEvent) {
    e.preventDefault();
    router.push("/home");
  }

  const currentModalTime =
    modalTrack && playerState.slug === modalTrack.slug ? playerState.currentTime : 0;

  const notesMarkup =
    notes.length === 0 ? (
      <div className="message">
        <p><strong>No notes yet</strong></p>
        <p>Be the first to leave a message.</p>
      </div>
    ) : (
      notes.map((row, i) => (
        <div className="message" key={`${row.created_at || "note"}-${i}`}>
          <p><strong>{row.display_name || "Anonymous"}</strong></p>
          {row.created_at ? <p className="msg-ts">{formatNoteDate(row.created_at)}</p> : null}
          <p>{row.note_body || ""}</p>
        </div>
      ))
    );

  return (
    <>
      <div className="top-chrome">
        <a href="/home" className="nav-round" aria-label="Back" onClick={backHome}>
          <img src="/apps/fartherhood/back.png" alt="Back" className="ico-img" />
        </a>

        <div className="nav-capsule" role="group" aria-label="Actions">
          <a
            href="#"
            className="nav-capsule-btn"
            aria-label="Collaborators"
            onClick={toggleCollabPopover}
            ref={collabBtnRef}
          >
            <img src="/apps/fartherhood/listen.png" alt="Collaborators" className="ico-img" />
          </a>

          <a href="#" className="nav-capsule-btn" aria-label="Share" onClick={onShare}>
            <img src="/apps/fartherhood/share.png" alt="Share" className="ico-img" />
          </a>

          <a href="#" className="nav-capsule-btn" aria-label="More">
            <img src="/apps/fartherhood/more.png" alt="More" className="ico-img" />
          </a>
        </div>
      </div>

      <div className="container">
        <main>
          <p className="note-meta">May 14, 2025 at 8:49 PM — Shared</p>
          <h1>
            CALIPH - <mark>FarTHErHOOD</mark>
          </h1>

          <p className="intro">
            A collection of stories, some connected others not about <mark>father</mark>hood and
            coparenting in the black community and how the lack thereof affects everyone differently.
          </p>

          <div className="audio-wrapper">
            {tracks.map((track, i) => {
              const preview = escapeHtml(track.transcript || "")
                .split("\n")
                .filter(Boolean)
                .slice(0, 2)
                .join(" ");

              const isActive = playerState.slug === track.slug;
              const isPlaying = isActive && playerState.isPlaying;

              return (
                <div key={track.slug}>
                  <section className="audio-card" data-index={i}>
                    <div className="card-head">
                      <div className="card-left">
                        <div className="card-title">{track.title}</div>
                        <div className="card-sub">{track.date}</div>
                        <div className="card-sub">Audio · 2m</div>
                      </div>

                      <button
                        className={`play-pill ${isPlaying ? "is-playing" : ""}`}
                        onClick={() => togglePlay(i)}
                        aria-label="Play"
                      >
                        <span className="play-icon">{isPlaying ? "⏸" : "▶"}</span>
                        <span className="play-text">{isPlaying ? "Pause" : "Play"}</span>
                      </button>
                    </div>

                    <div className="card-divider"></div>

                    <div
                      className="card-transcript"
                      role="button"
                      tabIndex={0}
                      onClick={() => openTranscript(i)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") openTranscript(i);
                      }}
                    >
                      <div className="t-label">Transcript</div>
                      <div
                        className="t-preview"
                        dangerouslySetInnerHTML={{ __html: preview }}
                      />
                    </div>
                  </section>

                  <p className="description">{track.description || ""}</p>
                </div>
              );
            })}
          </div>

          <div className="messages-section">
            <h2>Notes from Listeners</h2>
            <p className="notes-sub">
              Tap the bottom right icon and leave a note for your dad, about your dad, this project,
              your favorite song, or fatherhood in general.
            </p>

            {reloadHint ? (
              <p className="reload-hint">{reloadHint}</p>
            ) : null}

            <div className="notes-list">{notesMarkup}</div>
          </div>
        </main>
      </div>

      <div className="bottom-chrome" aria-label="Bottom actions">
        <div className="bottom-pill">
          <a href="#" className="nav-capsule-btn" aria-label="Subscribe">
            <img src="/apps/fartherhood/sub.png" alt="Subscribe" className="ico-img" />
          </a>

          <a href="#" className="nav-capsule-btn" aria-label="Buy">
            <img src="/apps/fartherhood/buy.png" alt="Buy" className="ico-img" />
          </a>

          <a href="#" className="nav-capsule-btn" aria-label="Draw">
            <img src="/apps/fartherhood/draw.png" alt="Draw" className="ico-img" />
          </a>
        </div>

        <a
          href="#"
          className="compose-fab"
          aria-label="Add note"
          onClick={(e) => {
            e.preventDefault();
            setNoteOpen((prev) => !prev);
          }}
        >
          <img src="/apps/fartherhood/note.png" alt="Add note" className="ico-img" />
        </a>
      </div>

      {noteOpen ? (
        <div className="note-form" style={{ display: "block" }}>
          <input
            type="text"
            value={noteName}
            onChange={(e) => setNoteName(e.target.value)}
            placeholder="Your name..."
            maxLength={60}
          />
          <textarea
            value={noteMessage}
            onChange={(e) => setNoteMessage(e.target.value)}
            placeholder="Your message to a father or about this project..."
            maxLength={500}
          />
          <button type="button" onClick={submitNote}>
            Submit
          </button>
        </div>
      ) : null}

      <div className={`modal ${modalTrack ? "open" : ""}`} aria-hidden={!modalTrack}>
        <div className="modal-backdrop" onClick={closeTranscript}></div>

        <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Transcript">
          <div className="sheet-handle"></div>

          <div className="sheet-top">
            <button className="sheet-ghost" aria-label="More">
              •••
            </button>
            <button className="sheet-done" aria-label="Done" onClick={closeTranscript}>
              ✓
            </button>
          </div>

          <div className="sheet-title">{modalTrack?.title || "CALIPH - STORY TIME"}</div>
          <div
            className="sheet-meta"
            dangerouslySetInnerHTML={{
              __html: `${formatModalDate(modalTrack?.date || "")} <span class="dot">•</span> ${
                modalTrack?.duration || "02:07"
              }`
            }}
          />

          <div className="sheet-body">{modalTrack?.transcript || ""}</div>

          <div className="sheet-player">
            <div className="sheet-timer">{formatTimer(currentModalTime)}</div>

            <div className="sheet-controls">
              <button
                className="sheet-skip"
                aria-label="Back 15 seconds"
                onClick={() => sendPlayerCommand("CALIPH_PLAYER_SEEK", { delta: -15 })}
              >
                ⟲15
              </button>
              <button
                className="sheet-play"
                aria-label="Play/Pause"
                onClick={() => {
                  if (!modalTrack) return;
                  const isSameTrack = playerState.slug === modalTrack.slug;

                  if (isSameTrack) {
                    sendPlayerCommand(
                      playerState.isPlaying ? "CALIPH_PLAYER_PAUSE" : "CALIPH_PLAYER_PLAY"
                    );
                  } else {
                    sendQueueToGlobal(modalIndex, true);
                  }
                }}
              >
                {modalTrack && playerState.slug === modalTrack.slug && playerState.isPlaying
                  ? "⏸"
                  : "▶"}
              </button>
              <button
                className="sheet-skip"
                aria-label="Forward 15 seconds"
                onClick={() => sendPlayerCommand("CALIPH_PLAYER_SEEK", { delta: 15 })}
              >
                15⟳
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={collabPopoverRef}
        className={`collab-popover ${collabOpen ? "open" : ""}`}
        aria-hidden={!collabOpen}
        style={collabStyle}
      >
        <div className="collab-nub" aria-hidden="true"></div>

        <div className="collab-head">
          <div className="collab-avatar">C</div>
          <div className="collab-head-text">
            <div className="collab-title">CALIPH — FarTHErHOOD</div>
            <div className="collab-sub">Production collaborators</div>
          </div>
        </div>

        <div className="collab-actions">
          <div className="collab-action">
            <div className="collab-action-ico">💬</div>
            <div className="collab-action-txt">message</div>
          </div>
          <div className="collab-action">
            <div className="collab-action-ico">🎥</div>
            <div className="collab-action-txt">video</div>
          </div>
          <div className="collab-action">
            <div className="collab-action-ico">📞</div>
            <div className="collab-action-txt">audio</div>
          </div>
        </div>

        <div className="collab-section">
          <div className="collab-section-title">Current Participants</div>
          <div className="collab-card">
            <div className="collab-card-title">Now collaborating</div>
            <div className="collab-card-sub">Producers credited on this note</div>
          </div>
        </div>

        <div className="collab-section">
          <div className="collab-section-title">Credits</div>

          <div className="collab-list">
            <div className="collab-row">
              <div className="collab-dot"></div>
              <div className="collab-row-main">
                <div className="collab-row-title">Story Time</div>
                <div className="collab-row-sub">
                  Prod. by <strong>S. Rudolph</strong>
                </div>
              </div>
              <div className="collab-tag">active</div>
            </div>

            <div className="collab-row">
              <div className="collab-dot"></div>
              <div className="collab-row-main">
                <div className="collab-row-title">Eater James</div>
                <div className="collab-row-sub">
                  Prod. by <strong>Caliph</strong>
                </div>
              </div>
              <div className="collab-tag">active</div>
            </div>

            <div className="collab-row">
              <div className="collab-dot"></div>
              <div className="collab-row-main">
                <div className="collab-row-title">Blue Corner</div>
                <div className="collab-row-sub">
                  Prod. by <strong>Caliph</strong>
                </div>
              </div>
              <div className="collab-tag">active</div>
            </div>

            <div className="collab-row">
              <div className="collab-dot"></div>
              <div className="collab-row-main">
                <div className="collab-row-title">Observations / A Dollar And A Dad</div>
                <div className="collab-row-sub">
                  Prod. by <strong>Caliph</strong>
                </div>
              </div>
              <div className="collab-tag">active</div>
            </div>

            <div className="collab-row">
              <div className="collab-dot"></div>
              <div className="collab-row-main">
                <div className="collab-row-title">Seeds</div>
                <div className="collab-row-sub">
                  Prod. by <strong>Caliph</strong>
                  <br />
                  Co Prod. by <strong>AyyDot</strong>
                </div>
              </div>
              <div className="collab-tag">active</div>
            </div>
          </div>
        </div>

        <div className="collab-foot">
          <div className="collab-foot-muted">Tip: tap outside to close</div>
        </div>
      </div>
    </>
  );
}