"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function FartherhoodEmbed() {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "CALIPH_NAVIGATE" && typeof data.href === "string") {
        try {
          event.source?.postMessage?.({ type: "CALIPH_NAVIGATE_ACK" }, "*");
        } catch {}

        router.push(data.href);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <main className="embedded-app-shell">
      <iframe
        ref={frameRef}
        src="/apps/fartherhood/index.html"
        title="FarTHErHOOD"
        className="embedded-app-frame"
      />
    </main>
  );
}
