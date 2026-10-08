import type { Metadata } from "next";
import { Sora, Source_Sans_3, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// The ledger voice: every figure in the app speaks in this face, the way a
// bookkeeper's numerals sit apart from the narrative hand.
const splineMono = Spline_Sans_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AFEMS — Farm ERP",
  description:
    "Argandu Farms Enterprise Management System — ledgers in, positions derived.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${sourceSans.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
