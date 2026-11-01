import type { ReactNode } from "react";
import GlobalQuickActions from "@/components/GlobalQuickActions";

export default function AppsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cos-apps-layout">
      {children}
      <GlobalQuickActions />
    </div>
  );
}
