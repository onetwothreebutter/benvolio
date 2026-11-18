import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PostHog's endpoints end in "/"; keep them as sent to the /ingest route.
  skipTrailingSlashRedirect: true,
  async headers() {
    // Pages like invite links must never leak their URL to other sites or to
    // our own analytics requests.
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin" }] }];
  },
};

// SENTRY_ORG, SENTRY_PROJECT and SENTRY_AUTH_TOKEN (for source maps) come from the environment.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  bundleSizeOptimizations: { excludeTracing: true, excludeDebugStatements: true },
});
