import type { Metadata } from "next";
import { AppShell } from "../components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendwise V1",
  description: "Sendwise V1 frontend shell",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
