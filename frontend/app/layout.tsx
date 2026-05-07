import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "../components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendwise",
  description: "Campagne email, AI e controllo operativonello stesso workspace.",
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
          signInFallbackRedirectUrl="/auth/redirect"
          signInForceRedirectUrl="/auth/redirect"
          signInUrl="/login"
        >
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
