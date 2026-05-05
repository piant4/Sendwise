import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email AI Platform V1 Skeleton",
  description: "Milestone 0 repository skeleton",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
