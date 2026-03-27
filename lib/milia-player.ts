export type MiliaQueueItem = {
  slug: string;
  title: string;
  artistName: string;
  placeLabel: string;
  audioUrl: string | null;
  coverUrl?: string | null;
};

type PlayerState = {
  currentSlug: string | null;
  isPlaying: boolean;
};

type Listener = (state: PlayerState) => void;

declare global {
  interface Window {
    __CALIPH_PLAYER_PLAY__?: (payload: {
      project: string;
      queue: MiliaQueueItem[];
      currentSlug: string;
      loop: boolean;
    }) => void;
  }
}

let audio: HTMLAudioElement | null = null;
let queue: MiliaQueueItem[] = [];
let currentSlug: string | null = null;
let isPlaying = false;
const listeners = new Set<Listener>();

function notify() {
  const state = { currentSlug, isPlaying };
  listeners.forEach((listener) => listener(state));
}

function ensureAudio() {
  if (audio) return audio;

  audio = new Audio();

  audio.addEventListener("play", () => {
    isPlaying = true;
    notify();
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    notify();
  });

  audio.addEventListener("ended", () => {
    const currentIndex = queue.findIndex((item) => item.slug === currentSlug);
    if (currentIndex === -1 || queue.length === 0) {
      currentSlug = null;
      isPlaying = false;
      notify();
      return;
    }

    const nextIndex = (currentIndex + 1) % queue.length;
    const nextItem = queue[nextIndex];
    if (!nextItem?.audioUrl) {
      currentSlug = null;
      isPlaying = false;
      notify();
      return;
    }

    currentSlug = nextItem.slug;
    audio!.src = nextItem.audioUrl;
    audio!.play().catch(() => {
      isPlaying = false;
      notify();
    });
  });

  return audio;
}

async function playLocalQueue(nextQueue: MiliaQueueItem[], slug: string) {
  queue = nextQueue.filter((item) => item.audioUrl);
  const nextItem = queue.find((item) => item.slug === slug);
  if (!nextItem?.audioUrl) return;

  const el = ensureAudio();

  if (currentSlug === slug && !el.paused) {
    el.pause();
    return;
  }

  if (currentSlug === slug && el.paused) {
    await el.play().catch(() => {});
    return;
  }

  currentSlug = slug;
  el.src = nextItem.audioUrl;
  el.currentTime = 0;
  await el.play().catch(() => {});
}

export async function playMiliaQueue(nextQueue: MiliaQueueItem[], slug: string) {
  if (typeof window !== "undefined" && typeof window.__CALIPH_PLAYER_PLAY__ === "function") {
    try {
      window.__CALIPH_PLAYER_PLAY__({
        project: "milia",
        queue: nextQueue,
        currentSlug: slug,
        loop: true,
      });
      return;
    } catch {
      // fall through to local queue player
    }
  }

  await playLocalQueue(nextQueue, slug);
}

export function subscribeMiliaPlayer(listener: Listener) {
  listeners.add(listener);
  listener({ currentSlug, isPlaying });

  return () => {
    listeners.delete(listener);
  };
}
