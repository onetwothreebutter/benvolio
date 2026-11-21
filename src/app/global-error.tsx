"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      {/* Outside the root layout, so the page's styles aren't loaded: the
          same paper and ink, written out. */}
      <head>
        <style>{`:root{color-scheme:light dark}body{background:#f5efe4;color:#2a2320}@media (prefers-color-scheme: dark){body{background:#1c1713;color:#f0e5d4}}`}</style>
      </head>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.5,
          padding: "3rem 1.5rem",
          maxWidth: "34rem",
          margin: "0 auto",
        }}
      >
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>Something went wrong</h1>
        <p>Your answers are saved. Please reload the page to carry on.</p>
      </body>
    </html>
  );
}
