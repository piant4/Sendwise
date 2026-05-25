import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "../components/layout/AppShell";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import { ThemeScript } from "../components/theme/ThemeScript";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendwise",
  description: "Campagne email, AI e controllo operativonello stesso workspace.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="theme">
        <ThemeScript />
        <ClerkProvider
          afterSignOutUrl="/login"
          signInFallbackRedirectUrl="/auth/redirect"
          signInForceRedirectUrl="/auth/redirect"
          signInUrl="/login"
          signUpForceRedirectUrl="/auth/redirect"
          signUpFallbackRedirectUrl="/auth/redirect"
        >
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
