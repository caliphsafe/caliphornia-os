import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import GlobalPlayer from "@/components/GlobalPlayer";
import GlobalQuickActions from "@/components/GlobalQuickActions";
import OnboardingTips from "@/components/OnboardingTips";

export const metadata: Metadata = {
  title: "Caliphornia OS",
  description: "A modular iPhone-style music and media platform."
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("caliph_os_session")?.value);

  return (
    <html lang="en">
      <body>
        {children}
        <OnboardingTips />
        {session ? <GlobalQuickActions /> : null}
        {session ? <GlobalPlayer email={session.email} /> : null}
      </body>
    </html>
  );
}
