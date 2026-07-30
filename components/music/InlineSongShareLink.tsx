"use client";

import { buildShareHref } from "@/lib/share-navigation";

export default function InlineSongShareLink({
  songId,
  songSlug,
  title,
  className = "",
}: {
  songId?: string | null;
  songSlug?: string | null;
  title: string;
  className?: string;
}) {
  const disabled = !songId && !songSlug;

  return (
    <a
      href={
        disabled
          ? undefined
          : buildShareHref({
              songId,
              songSlug,
            })
      }
      className={`cos-inline-song-share ${className}`.trim()}
      aria-disabled={disabled}
      aria-label={`Share ${title}`}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
    >
      <span aria-hidden="true">⌁</span>
      <strong>Share</strong>
    </a>
  );
}
