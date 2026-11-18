import type { Metadata, Viewport } from "next";
import { DESCRIPTION, PRODUCT_NAME } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: DESCRIPTION,
};

// Keep in step with --bg in globals.css.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a17" },
  ],
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
