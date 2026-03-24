"use client";

import Link from "next/link";
import type { AppItem } from "@/lib/app-registry";

export default function AppIcon({
  app,
  email
}: {
  app: AppItem;
  email: string;
}) {
  // 👇 dynamically fix Music app link
  const href =
    app.id === "music"
      ? `/apps/music?email=${encodeURIComponent(email)}`
      : app.href;

  return (
    <Link href={href} className="app-icon ios-app-icon">
      <div className="app-icon-tile ios-app-icon-tile">
        <img src={app.icon} alt={app.name} className="app-icon-image" />
        <div className="icon-shine" />
        <div className="icon-glow" />
      </div>
      <span className="app-icon-label">{app.name}</span>
    </Link>
  );
}
