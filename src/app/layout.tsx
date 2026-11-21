import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import { DESCRIPTION, PRODUCT_NAME } from "@/lib/copy";
import "./globals.css";

// Self-hosted at build time. globals.css reads these as --font-serif and --font-sans.
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: DESCRIPTION,
};

// Keep in step with --bg in globals.css.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1713" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
