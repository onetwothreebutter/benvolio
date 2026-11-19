# End-to-end tests

Playwright drives the real app, on a phone-sized Chromium, against a local
Supabase running in Docker. Nothing touches production: the config refuses any
Supabase that isn't on localhost, and it blanks the PostHog and Sentry keys.

## Running them

```sh
npx supabase start          # Docker: database with the migrations, auth, and a Mailpit inbox
npx playwright install chromium   # once
npm run e2e                 # starts `next dev` on :3000 if nothing is running there
```

`npm run e2e -- --ui` opens Playwright's UI; `npm run e2e -- sign-in` runs one file.
CI runs the same suite against a production build (`CI=1`).

If a dev server is already running on :3000 with `.env.local` pointing at the
real Supabase, stop it first: the tests reuse whatever is on that port.

## How sign-in works in tests

Local Supabase delivers every email to Mailpit instead of sending it.
`support/mail.ts` reads the code (and the link) from there, so tests sign in
exactly as people do. `supabase/config.toml` uses the same email template as
production (see docs/auth.md) and raises the rate limits so parallel tests
don't trip them. Each test makes its own people with unique addresses, so
nothing needs resetting between runs.

## What's covered

- `sign-in.spec.ts`: code and link sign-in, the name step, sign-out, wrong
  codes, used links, returning to the page that asked.
- `start.spec.ts`: starting a Benvolio, form errors, renewing the invite link.
- `invite.spec.ts`: joining from the link (signed in or not, any email),
  rewording the question, used, expired, own and made-up links, strangers.
- `conversation.spec.ts`: a whole Benvolio, both people, all six sittings to
  the finish, checking what each person's page says at every turn.
- `dead-ends.spec.ts`: 404s, signed-out redirects, broken links, unsafe `next`.

The writing screens and the button to accept new wording aren't built yet, so
`conversation.spec.ts` puts that writing into the database
(`support/sittings.ts`, validated with the model's own parser). When those
screens land, switch it to typing into them.

Selectors are roles and labels, as people see the page, so restyling doesn't
break the tests; changing visible wording does.
