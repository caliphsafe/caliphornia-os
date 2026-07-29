import type { Metadata } from "next";
import "./globals.css";
import GlobalPlayer from "@/components/GlobalPlayer";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Caliphornia OS",
  description: "A connected digital music world for Caliph."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  return (
    <html lang="en">
      <body>
        {children}
        {session?.email ? <GlobalPlayer /> : null}
      </body>
    </html>
  );
}
