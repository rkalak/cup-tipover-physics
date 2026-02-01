import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cup Tipover Physics Analyzer",
  description: "Analyze tipover physics of cup gaussian splats",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
