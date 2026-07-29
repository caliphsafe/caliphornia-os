import Link from "next/link";
import type { AppItem } from "@/lib/app-registry";

export default function AppIcon({ app }: { app: AppItem }) {
  return (
    <Link href={app.href} className="app-icon">
      <span className="icon-tile">
        <img src={app.icon} alt="" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />
      </span>
      <span>{app.name}</span>
    </Link>
  );
}
