# Analytics and monitoring

Benvolio records what happens in a conversation, never what anyone writes in it.

## The privacy rule

- Analytics events carry only ids, enum slugs, numbers and booleans. The full
  list is typed in `src/lib/analytics/events.ts`, and `findUnsafeProperty`
  drops (and reports) any event whose values could be free text.
- Every URL-looking value is stripped of query strings, fragments and token-like path segments
  before they are sent (`src/lib/analytics/redact-url.ts`), so invite links
  never reach PostHog or Sentry.
- PostHog autocapture, session replay, dead clicks, heatmaps, exception capture,
  console logs, surveys and feature flags are all switched off in code, so a
  setting in the PostHog project cannot turn them on. Sentry session replay is not
  installed. Sentry error reports have request bodies, cookies, headers and
  user details turned off, console output is not recorded, and URLs, emails
  and tokens are scrubbed from every remaining string, including error messages (`src/lib/monitoring/sentry-options.ts`).
- People are identified by their opaque id, never their email; anything else is
  dropped. PostHog keeps its state in localStorage, not cookies, and every page
  sends `Referrer-Policy: strict-origin`.
- Page titles must never include conversation content: PostHog drops the
  `title` property, but browsers show titles elsewhere too.
- Error messages are scrubbed of URLs, emails, tokens and quoted input, and cut
  to 2,000 characters. Sentry's own ids are left intact. Our own code must never
  put what someone wrote into an error message: unquoted text in a message is
  not caught.
- URL redaction is a heuristic: it catches tokens with a digit, ids after
  `/join/` and `/b/`, emails and encoded text in paths, but not a URL written
  without a scheme. Invite tokens should therefore always contain a digit.
- PostHog sees no client IP (the `/ingest` route doesn't pass it on), so
  locations in PostHog are the server's, not people's.

## Tools

| Tool | Watches | Set up in |
| --- | --- | --- |
| PostHog | Funnels from invite to finish, waits between turns, where conversations stall, web vitals, the end-of-conversation rating (a typed event, since PostHog surveys are off) | `src/instrumentation-client.ts`, `src/lib/analytics/`, `src/app/ingest/` |
| Sentry | Errors on the client, server and edge (errors only, no tracing) | `src/instrumentation*.ts`, `src/lib/monitoring/` |
| Sentry cron monitors | The hourly reminder job (added with that job) | later PR |
| Postmark webhooks | Bounces and spam complaints, recorded as PostHog events (added with email) | later PR |
| Uptime monitor | The site being reachable | external, see below |

Both PostHog and Sentry are proxied through the app's own domain (the `/ingest`
route, which forwards no cookies, Referer or IP address, and Sentry's managed
tunnel) so ad blockers don't drop them. Without their environment
variables (see `.env.example`), both are switched off.

## Setting up the accounts

1. **PostHog:** create a project and copy its project API key into
   `NEXT_PUBLIC_POSTHOG_KEY` in Vercel. For an EU project, also set the two EU
   host variables in `.env.example` (they are read at build time). In Project
   settings, turn on "Discard client IP data".
2. **Sentry:** create a Next.js project. Put its DSN in `NEXT_PUBLIC_SENTRY_DSN`,
   and set `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` so builds
   upload source maps. Add an alert rule that emails on new issues.
3. **Uptime:** add a free HTTP monitor (for example Better Stack) for the home
   page, checking every 3 minutes and emailing on failure.
