import type * as Sentry from "@sentry/nextjs";
import { mapStringsDeep, scrubText } from "@/lib/analytics/redact-url";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;

// Stack frames and build metadata hold file names and hashes Sentry needs to
// match source maps. They come from our code, not from people.
const UNSCRUBBED_KEYS = new Set(["stacktrace", "debug_meta", "sdk"]);

/** Scrubs URLs, emails and tokens from every string in an event or breadcrumb. */
export function scrub<T>(value: T): T {
  return mapStringsDeep(value, scrubText, UNSCRUBBED_KEYS);
}

/**
 * Errors only, no tracing. Sentry's own data collection is turned off for
 * anything that could hold what someone wrote or who they are, console output
 * is not recorded, and every remaining string is scrubbed before sending.
 * With no DSN set, Sentry sends nothing.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend: (event) => scrub(event),
  // Console output can contain anything, including what people wrote.
  beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === "console" ? null : scrub(breadcrumb)),
} satisfies Options;
