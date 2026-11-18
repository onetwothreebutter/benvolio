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
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1rem", maxWidth: "34rem", margin: "0 auto" }}>
        <h1>Something went wrong</h1>
        <p>Your answers are saved. Please reload the page to carry on.</p>
      </body>
    </html>
  );
}
