import type * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { MAX_SCRUBBED_LENGTH, mapStringsDeep, redactUrl, scrubText } from "@/lib/analytics/redact-url";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;
type Frame = { filename?: string; abs_path?: string; module?: string };

const scrubAll = <T>(value: T): T => mapStringsDeep(value, scrubText);

/**
 * Bundled files keep their names and hashes so source maps still match, minus
 * any query string. Anything else (an inline script names the page URL) is
 * redacted like any other URL.
 */
function scrubFrameFile(value: string | undefined): string | undefined {
  if (value === undefined) return value;
  const [path] = value.split(/[?#]/, 1);
  return path.startsWith("app:///") || path.includes("/_next/") ? path : redactUrl(path);
}

function scrubFrames(frames: Frame[] | undefined) {
  return frames?.map((frame) => ({
    ...frame,
    filename: scrubFrameFile(frame.filename),
    abs_path: scrubFrameFile(frame.abs_path),
    module: scrubFrameFile(frame.module),
  }));
}

/**
 * Scrubs the parts of an event that can hold free text: messages, exception
 * values, the request, breadcrumbs, extra data, tags and contexts. Sentry's
 * own ids (event_id, release, trace ids) are left alone, since the scrubber
 * would mistake them for tokens and Sentry rejects events without them.
 * (Local variables are never collected: includeLocalVariables stays unset.)
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  const { trace, ...contexts } = event.contexts ?? {};
  return {
    ...event,
    message: event.message && scrubText(event.message),
    logentry: scrubAll(event.logentry),
    request: scrubAll(event.request),
    breadcrumbs: scrubAll(event.breadcrumbs),
    extra: scrubAll(event.extra),
    tags: scrubAll(event.tags),
    contexts: event.contexts && { ...scrubAll(contexts), ...(trace && { trace }) },
    exception: event.exception && {
      ...event.exception,
      values: event.exception.values?.map((value) => ({
        ...value,
        value: value.value && scrubText(value.value),
        stacktrace: value.stacktrace && {
          ...value.stacktrace,
          frames: scrubFrames(value.stacktrace.frames),
        },
      })),
    },
  };
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
