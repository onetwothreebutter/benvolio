import type * as Sentry from "@sentry/nextjs";
import { MAX_SCRUBBED_LENGTH, mapStringsDeep, scrubText } from "@/lib/analytics/redact-url";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;

type Frame = { filename?: string; abs_path?: string; module?: string };

function stripQuery(value: unknown): unknown {
  return typeof value === "string" ? value.split(/[?#]/, 1)[0] : value;
}

/**
 * Stack frames keep file names and hashes so source maps still match, but an
 * inline script's frame names the page URL, so its query string is cut.
 * (Local variables are never collected: includeLocalVariables stays unset.)
 */
function scrubStacktrace(stacktrace: unknown): unknown {
  if (typeof stacktrace !== "object" || stacktrace === null) return stacktrace;
  const { frames } = stacktrace as { frames?: Frame[] };
  if (!Array.isArray(frames)) return stacktrace;
  return {
    ...stacktrace,
    frames: frames.map((frame) => ({
      ...frame,
      filename: stripQuery(frame.filename),
      abs_path: stripQuery(frame.abs_path),
      module: stripQuery(frame.module),
    })),
  };
}

// Build metadata and the SDK's own settings hold no user data and must stay intact.
const keep = (v: unknown) => v;
const SPECIAL_KEYS = { stacktrace: scrubStacktrace, debug_meta: keep, sdk: keep };

/** Scrubs URLs, emails, tokens and quoted input from every string in an event or breadcrumb. */
export function scrub<T>(value: T): T {
  return mapStringsDeep(value, scrubText, SPECIAL_KEYS);
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
  maxValueLength: MAX_SCRUBBED_LENGTH,
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
