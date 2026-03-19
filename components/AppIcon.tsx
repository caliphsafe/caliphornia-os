import Link from "next/link";
import type { AppItem } from "@/lib/app-registry";

export default function AppIcon({ app }: { app: AppItem }) {
  return (
    <Link href={app.href} className="app-icon">
      <div className="app-icon-tile">
        <img src={app.icon} alt={app.name} className="app-icon-image" />
      </div>
      <span className="app-icon-label">{app.name}</span>
    </Link>
  );
}
