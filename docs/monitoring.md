# Analytics and monitoring

Benvolio records what happens in a conversation, never what anyone writes in it.

## The privacy rule

- Analytics events carry only ids, enum slugs, numbers and booleans. The full
  list is typed in `src/lib/analytics/events.ts`, and `findUnsafeProperty`
  drops (and reports) any event whose values could be free text.
- Every URL-looking value is stripped of query strings, fragments and token-like path segments
  before they are sent (`src/lib/analytics/redact-url.ts`), so invite links
  never reach PostHog or Sentry.
- PostHog autocapture and session replay are off. Sentry session replay is not
  installed. Sentry error reports have request bodies, cookies, headers and
  user details turned off, and breadcrumb URLs redacted too (`src/lib/monitoring/sentry-options.ts`).
- People are identified by their opaque id, never their email.

## Tools

| Tool | Watches | Set up in |
| --- | --- | --- |
| PostHog | Funnels from invite to finish, waits between turns, where conversations stall, web vitals, the end-of-conversation survey | `instrumentation-client.ts`, `src/lib/analytics/` |
| Sentry | Errors on the client, server and edge, (errors only, no tracing) | `instrumentation*.ts`, `src/lib/monitoring/` |
| Sentry cron monitors | The hourly reminder job (added with that job) | later PR |
| Postmark webhooks | Bounces and spam complaints, recorded as PostHog events (added with email) | later PR |
| Uptime monitor | The site being reachable | external, see below |

Both PostHog and Sentry are proxied through the app's own domain (`/ingest` and
`/monitoring`) so ad blockers don't drop them. Without their environment
variables (see `.env.example`), both are switched off.

## Setting up the accounts

1. **PostHog:** create a project and copy its project API key into
   `NEXT_PUBLIC_POSTHOG_KEY` in Vercel. For an EU project, also set the two EU
   host variables in `.env.example`.
2. **Sentry:** create a Next.js project. Put its DSN in `NEXT_PUBLIC_SENTRY_DSN`,
   and set `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` so builds
   upload source maps. Add an alert rule that emails on new issues.
3. **Uptime:** add a free HTTP monitor (for example Better Stack) for the home
   page, checking every 3 minutes and emailing on failure.
