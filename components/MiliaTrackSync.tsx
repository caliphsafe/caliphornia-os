"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

function getCurrentTrackSlugFromPlayerState(data: any) {
  return data?.playlistSongSlug || data?.slug || null;
}

export default function MiliaTrackSync({
  currentSlug,
}: {
  currentSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "CALIPH_PLAYER_STATE") return;

      const activeSlug = getCurrentTrackSlugFromPlayerState(data);
      const sourceApp = data?.sourceApp || null;

      if (!activeSlug || sourceApp !== "milia") return;
      if (activeSlug === currentSlug) return;

      const nextPath = `/apps/milia/${activeSlug}`;
      if (pathname !== nextPath) {
        router.push(nextPath);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentSlug, pathname, router]);

  return null;
}
