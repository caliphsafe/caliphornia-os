"use client";

import Link from "next/link";
import type { GlobalTrack } from "@/components/GlobalPlayer";

type Conversation = {
  id: string;
  slug: string;
  title: string;
  avatar_letter?: string | null;
  list_preview?: string | null;
  last_activity_label?: string | null;
  sort_order?: number | null;
  can_open_conversation?: boolean;
  locked_reason?: string | null;
  final_track?: {
    slug: string;
    title: string;
    artist?: string | null;
    file?: string | null;
    playlist_song_slug?: string | null;
    analytics_song_slug?: string | null;
    is_preview?: boolean;
    clip_start_seconds?: number | null;
    clip_end_seconds?: number | null;
  } | null;
};

function buildFriendsQueue(conversations: Conversation[]): GlobalTrack[] {
  return conversations
    .map((convo) => {
      const track = convo.final_track;
      if (!track?.file) return null;

      return {
        id: track.slug,
        slug: track.slug,
        title: track.title,
        artist: track.artist || "Caliph",
        displayTitle: track.title,
        file: track.file,
        playlistSongSlug: track.playlist_song_slug || track.slug,
        analyticsSongSlug: track.analytics_song_slug || track.slug,
        sourceApp: "friends",
        conversationSlug: convo.slug,
        conversationRoute: `/apps/friends/${convo.slug}`,
        isPreview: Boolean(track.is_preview),
        clipStartSeconds: track.clip_start_seconds ?? null,
        clipEndSeconds: track.clip_end_seconds ?? null,
      } satisfies GlobalTrack;
    })
    .filter(Boolean) as GlobalTrack[];
}

export default function FriendsInboxClient({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const queue = buildFriendsQueue(conversations);

  function playPreview(
    event: React.MouseEvent<HTMLAnchorElement>,
    thread: Conversation
  ) {
    if (thread.can_open_conversation) return;

    event.preventDefault();

    const startIndex = Math.max(
      0,
      queue.findIndex((track) => track.conversationSlug === thread.slug)
    );

    if (!queue.length) return;

    window.postMessage(
      {
        type: "CALIPH_PLAYER_TOGGLE_TRACK",
        tracks: queue,
        startIndex,
      },
      "*"
    );
  }

  return (
    <main className="friends-original-thread-list" aria-label="Track list">
      {conversations.map((thread) => {
        const canOpen = Boolean(thread.can_open_conversation);

        return (
          <Link
            key={thread.id}
            href={canOpen ? `/apps/friends/${thread.slug}` : "#"}
            className={`friends-original-thread-row ${
              canOpen ? "" : "is-preview-only"
            }`}
            aria-label={
              canOpen
                ? `Open conversation with ${thread.title}`
                : `Play preview for ${thread.title}`
            }
            prefetch={canOpen}
            onClick={(event) => playPreview(event, thread)}
          >
            {thread.sort_order === 1 ? (
              <span className="friends-original-thread-unread-dot"></span>
            ) : null}

            <div className="friends-original-thread-avatar group">
              {thread.avatar_letter || thread.title?.[0] || "F"}
            </div>

            <div className="friends-original-thread-main">
              <div className="friends-original-thread-topline">
                <div className="friends-original-thread-title">
                  {thread.title}
                </div>

                {!canOpen ? (
                  <span className="friends-preview-badge">Preview</span>
                ) : null}
              </div>

              <div className="friends-original-thread-preview">
                {canOpen
                  ? thread.list_preview || ""
                  : thread.locked_reason ||
                    "Unlock Fri.ends to view the full conversation."}
              </div>
            </div>

            <div className="friends-original-thread-time">
              {canOpen ? thread.last_activity_label || "" : "30s"}
            </div>
          </Link>
        );
      })}
    </main>
  );
}
