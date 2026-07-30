import "./globals.css";
import "./caliph-admin-music.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import GlobalPlayer from "@/components/GlobalPlayer";
import GlobalQuickActions from "@/components/GlobalQuickActions";
import OnboardingTips from "@/components/OnboardingTips";
import GlobalSongShareBridge from "@/components/music/GlobalSongShareBridge";

export const metadata: Metadata = {
  title: "Caliphornia OS",
  description: "A modular iPhone-style music and media platform.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  return (
    <html lang="en">
      <body>
        {children}
        {session ? <GlobalQuickActions /> : null}
        {session ? <GlobalSongShareBridge /> : null}
        {session ? <OnboardingTips /> : null}
        {session ? <GlobalPlayer email={session.email} /> : null}
      </body>
    </html>
  );
}
