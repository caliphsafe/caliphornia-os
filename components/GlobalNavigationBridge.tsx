"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps internal Caliphornia OS navigation inside the Next.js App Router.
 * Existing app pages use many ordinary <a href> elements. Without this bridge,
 * those links perform a full document reload and remount the root audio player.
 */
export default function GlobalNavigationBridge() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as
        | HTMLAnchorElement
        | null;

      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.nativeNavigation === "true") return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);

      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      router.push(
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [router]);

  return null;
}
