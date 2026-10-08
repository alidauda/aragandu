import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// One family, precise and geometric: titles, body and figures (tabular) alike.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
