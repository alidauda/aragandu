import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

// The Argandu type system (brand guidelines), self-hosted from /fonts:
// Ojuju Bold for the logotype and main headings, Acme for subheadings and
// buttons, Jost for body text.

export const metadata: Metadata = {
  title: "Argandu Farms",
  description: "Argandu Farms — honoring a royal agricultural legacy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preload" href="/fonts/jost-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/ojuju-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/acme-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
