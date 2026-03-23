import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import GlobalPlayer from "@/components/GlobalPlayer";

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
        {session ? <GlobalPlayer email={session.email} /> : null}
      </body>
    </html>
  );
}
