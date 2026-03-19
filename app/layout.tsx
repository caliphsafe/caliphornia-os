export const metadata = {
  title: "Caliphornia OS",
  description: "Caliphornia OS"
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
