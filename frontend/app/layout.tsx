import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
    <html lang="it">
      <body className="theme">
        <ClerkProvider
          afterSignOutUrl="/login"
          signInFallbackRedirectUrl="/admin"
          signInForceRedirectUrl="/admin"
          signInUrl="/login"
        >
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
