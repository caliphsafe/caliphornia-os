"use client";

import { buildShareHref } from "@/lib/share-navigation";

export default function ShareSongButton({
  songId,
  songSlug,
  title,
}: {
  songId?: string | null;
  songSlug?: string | null;
  title: string;
}) {
  const disabled = !songId && !songSlug;

  return (
    <a
      className={`music-share-button${disabled ? " is-disabled" : ""}`}
      href={disabled ? undefined : buildShareHref({ songId, songSlug })}
      aria-disabled={disabled}
      aria-label={`Open Share for ${title}`}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
    >
      Share
    </a>
  );
}
