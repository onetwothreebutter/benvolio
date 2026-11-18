import type * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { MAX_SCRUBBED_LENGTH, mapStringsDeep, redactUrl, scrubText } from "@/lib/analytics/redact-url";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;
type Frame = { filename?: string; abs_path?: string; module?: string };

const scrubAll = <T>(value: T): T => mapStringsDeep(value, scrubText);

/**
 * Bundled and installed files keep their names and hashes so source maps and
 * grouping still work, minus
 * any query string. Their source lines are our code, not people's writing.
 * Anything else (an inline script names the page URL) is
 * redacted like any other URL.
 */
function scrubFrameFile(value: string | undefined): string | undefined {
  if (value === undefined) return value;
  const [path] = value.split(/[?#]/, 1);
  const bundled = /^app:\/\/\/|\/(_next|\.next|node_modules)\//.test(path);
  return bundled ? path : redactUrl(path);
}

function scrubFrames(frames: Frame[] | undefined) {
  return frames?.map((frame) => ({
    ...frame,
    filename: scrubFrameFile(frame.filename),
    abs_path: scrubFrameFile(frame.abs_path),
    module: scrubFrameFile(frame.module),
  }));
}

const keep = (value: unknown) => value;
const scrubStacktrace = (value: unknown) =>
  value && typeof value === "object"
    ? { ...value, frames: scrubFrames((value as { frames?: Frame[] }).frames) }
    : value;

// Sentry's own ids look like tokens to the scrubber, and Sentry rejects or
// can't link events without them. Everything else is scrubbed, so a field
// Sentry adds later is covered by default. (`trace` is contexts.trace: ids
// only while tracing is off; scrub its data if tracing is ever enabled.) These
// keys are skipped at any depth, so our own code must not use them as names in
// extra, tags or contexts.
const SENTRY_ID_KEYS = Object.fromEntries(
  ["event_id", "release", "dist", "trace", "trace_id", "span_id", "parent_span_id", "sdk", "debug_meta"].map(
    (key) => [key, keep],
  ),
);
const SPECIAL_KEYS = { ...SENTRY_ID_KEYS, stacktrace: scrubStacktrace };

/**
 * Scrubs every string in an event (messages, exception values, the
 * transaction name, the request, breadcrumbs, extra data, tags, user and
 * contexts) except Sentry's own ids and bundle file names in stack frames.
 * (Local variables are never collected: includeLocalVariables stays unset.)
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  return mapStringsDeep(event, scrubText, SPECIAL_KEYS);
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output can contain anything, including what people wrote.
  return breadcrumb.category === "console" ? null : scrubAll(breadcrumb);
}

/**
 * Errors only, no tracing. Sentry's own data collection is turned off for
 * anything that could hold what someone wrote or who they are, console output
 * is not recorded, and every free-text field is scrubbed before sending.
 * With no DSN set, Sentry sends nothing.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  maxValueLength: MAX_SCRUBBED_LENGTH,
  // No trace headers on outgoing requests (e.g. to PostHog).
  tracePropagationTargets: [],
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
} satisfies Options;
