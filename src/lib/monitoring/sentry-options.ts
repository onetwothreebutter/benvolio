import type * as Sentry from "@sentry/nextjs";
import { redactUrlsDeep } from "@/lib/analytics/redact-url";

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;

/**
 * Errors only, no tracing. Sentry's own data collection is turned off for
 * anything that could contain what someone wrote or who they are, and every
 * URL in an event or breadcrumb loses its query string and tokens.
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
  beforeSend: (event) => redactUrlsDeep(event),
  beforeBreadcrumb: (breadcrumb) => redactUrlsDeep(breadcrumb),
} satisfies Options;
