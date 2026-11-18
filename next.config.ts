import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace("://us.i.", "://us-assets.i.").replace(
  "://eu.i.",
  "://eu-assets.i.",
);

const nextConfig: NextConfig = {
  // PostHog calls go through our own domain so ad blockers don't drop them.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG_HOST}/:path*` },
    ];
  },
  // Required by the PostHog proxy above.
  skipTrailingSlashRedirect: true,
};

// SENTRY_ORG, SENTRY_PROJECT and SENTRY_AUTH_TOKEN (for source maps) come from the environment.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Sends Sentry reports through our domain for the same reason as PostHog.
  tunnelRoute: "/monitoring",
});
