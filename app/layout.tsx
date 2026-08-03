import "./globals.css";
import "./caliph-admin-music.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import GlobalPlayer from "@/components/GlobalPlayer";
import GlobalSongShareBridge from "@/components/music/GlobalSongShareBridge";
import GlobalNavigationBridge from "@/components/GlobalNavigationBridge";
import AppViewportBoundary from "@/components/AppViewportBoundary";

export const metadata: Metadata = {
  title: "Caliphornia OS",
  description: "A modular iPhone-style music and media platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const session = verifySession(
    cookieStore.get("caliph_os_session")?.value,
  );

  return (
    <html lang="en">
      <body>
        <AppViewportBoundary>
          {children}
        </AppViewportBoundary>

        <GlobalNavigationBridge />

        {session ? <GlobalSongShareBridge /> : null}

        {session ? (
          <GlobalPlayer email={session.email} />
        ) : null}
      </body>
    </html>
  );
}
