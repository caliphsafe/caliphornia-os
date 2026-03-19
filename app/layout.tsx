import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Caliphornia OS",
  description: "A modular iPhone-style music and media platform."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
