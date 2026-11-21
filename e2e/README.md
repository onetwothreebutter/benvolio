# End-to-end tests

Playwright drives the real app, on a phone-sized Chromium, against a local
Supabase running in Docker. Nothing touches production: the config refuses any
Supabase that isn't on localhost, and it blanks the PostHog and Sentry keys.

## Running them

```sh
npx supabase start          # Docker: database with the migrations, auth, and a Mailpit inbox
npx playwright install chromium   # once
npm run e2e                 # starts `next dev` on :3100 for the run
```

`npm run e2e -- --ui` opens Playwright's UI (its Copy test uses your real
clipboard there); `npm run e2e -- sign-in` runs one file.
`CI=1 npm run e2e` builds and tests a production build, as CI does.

The app under test runs on :3100, and Playwright always starts its own server
there, so a dev server you have open (which talks to production Supabase
through `.env.local`) is never reused. Stop anything else on :3100 first.

## How sign-in works in tests

Local Supabase delivers every email to Mailpit instead of sending it.
`support/mail.ts` reads the code (and the link) from there, so tests sign in
exactly as people do. `supabase/config.toml` uses the same email template as
production (see docs/auth.md) and raises the rate limits so parallel tests
don't trip them. Each test makes its own people with unique addresses, so
nothing needs resetting between runs.

## How the app's own emails work in tests

The app sends turn emails through Resend's API. Under test, `RESEND_API_URL`
points it at `support/fake-resend.ts`, a stand-in Playwright starts on :3101.
It checks each request as Resend would (API key, idempotency key, fields)
and delivers it to Mailpit, so `support/mail.ts` reads turn emails the same
way as sign-in codes, by recipient and subject.

## What's covered

- `sign-in.spec.ts`: code and link sign-in, the name step, signing out on one
  phone only, wrong and malformed codes, used links, returning to the page
  that asked.
- `start.spec.ts`: starting a Benvolio, the pace, every form error, sharing
  and copying the link, renewing it (including from stale pages).
- `invite.spec.ts`: joining from the link (signed in or not, any email, by
  code or emailed link), stopping at the name step, used, expired, own and
  made-up links, strangers.
- `conversation.spec.ts`: rewording the question (used or kept), then a whole
  Benvolio, both people, all six sittings to the finish, checking what each
  person's page says at every turn.
- `emails.spec.ts`: turn emails to the right person at each step (ready to
  begin, partner waiting, writing to read, new wording, wording settled),
  never to the person acting, each with a link that opens the Benvolio.
- `reminders.spec.ts`: the daily check-in refuses calls without
  `CRON_SECRET`, reminds only the person whose turn it has been for a few
  quiet days (time passes by moving `active_at` back), links to the
  Benvolio, and sends nothing more on a second run. Locally, Benvolios left
  by earlier runs go quiet too and get reminders in Mailpit; `npx supabase
  db reset` clears them.
- `dead-ends.spec.ts`: 404s, signed-out redirects, broken links, unsafe `next`.

Not covered, as each needs a fault or timing the tests can't arrange: the
global error page, "We couldn't send the email", the "Too many tries" message,
and opening the emailed link in a different browser from the one that asked.

Every sitting is typed into the page (`support/sittings.ts`), using the
fixtures the unit tests check against the model's parser.

Selectors are roles and labels, as people see the page, so restyling doesn't
break the tests; changing visible wording does.
