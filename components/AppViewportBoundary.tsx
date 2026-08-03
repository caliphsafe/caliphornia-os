"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./AppViewportBoundary.module.css";

export default function AppViewportBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const routeRef = useRef<HTMLDivElement | null>(null);

  const isOsViewport =
    pathname === "/home" ||
    pathname.startsWith("/apps/");

  useEffect(() => {
    if (!isOsViewport) return;

    const main =
      routeRef.current?.querySelector<HTMLElement>("main");

    if (main) {
      main.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
  }, [pathname, isOsViewport]);

  if (!isOsViewport) {
    return <>{children}</>;
  }

  return (
    <div
      className={styles.viewport}
      data-caliphornia-route={pathname}
    >
      <div
        ref={routeRef}
        className={styles.route}
        key={pathname}
      >
        {children}
      </div>
    </div>
  );
}
