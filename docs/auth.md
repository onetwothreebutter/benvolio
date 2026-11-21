# Sign-in

People sign in with their email. We send a one-time code, and the same email
carries a link for anyone who'd rather tap. The code matters on phones: email
apps often open links in their own browser, which would sign the person in
there instead of in the browser they started in.

Signing in always passes through `/welcome`, which asks new people for a
first name (stored in `public.people`) and sends everyone else straight on. Pages that need an account call `requirePerson()` (or
`requireSignedIn()`) from `src/lib/auth/session.ts`, which sends people to sign
in and then back to where they were. Every `next` address goes through
`safeNext()`, so a crafted link can't send anyone to another site.

## Supabase settings

These live in the Supabase dashboard rather than in code.

**Authentication > URL Configuration**

- Site URL: `https://benvolio.app`. The emailed
  link is built from it, so links from preview deployments also go to
  production; on previews, type the code instead.
- Redirect URLs: none needed. The app never asks Supabase to redirect, so
  there is no allowlist to keep narrow.

**Authentication > Emails > Templates**: use the same body for both
"Confirm signup" (first sign-in) and "Magic Link" (every later one): paste
[`supabase/templates/sign-in.html`](../supabase/templates/sign-in.html), which
local Supabase and the end-to-end tests also use.

Subject: `Your Benvolio code: {{ .Token }}`

The link opens a page with a Continue button rather than signing in on load,
because email security scanners open links and would otherwise use up the
one-time token. Where to go afterwards is kept in a short-lived cookie in the
browser that asked for the code; in any other browser the link lands on the
home page.

**Authentication > Emails > SMTP Settings**: Supabase's built-in email only
reaches members of the Supabase project and sends a few emails an hour. Before
inviting anyone else, send through Resend, which also sends the conversation
emails. Mail goes out from the `mail.benvolio.app` subdomain, so its sending
reputation is kept apart from `benvolio.app` itself.

1. In Resend, add the domain `mail.benvolio.app` and create the DNS records it
   lists (SPF, DKIM and the bounce MX) at your DNS provider. Wait until Resend
   shows it as verified.
2. Create a Resend API key with sending access.
3. In Supabase, turn on custom SMTP with host `smtp.resend.com`, port 465,
   user `resend`, the API key as the password, sender email
   `hello@mail.benvolio.app` and sender name `Benvolio`.

Supabase's rate limits are the only thing stopping the
sign-in form from emailing strangers; if that becomes a problem, add CAPTCHA
(Authentication > Attack Protection, plus passing its token to
`signInWithOtp`).

## Environment

| Variable | Where | Secret |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel, `.env.local` | No |
| `SUPABASE_SECRET_KEY` | Vercel (Production and Preview) | Yes |
| `SITE_URL` | Vercel (Production): `https://benvolio.app` | No |

## Invites

An invite is a link with a random token; the database keeps only its hash.
Anyone who opens the link and signs in can join, whatever email they use: the
email typed when starting is only where invite emails will go. The link works once
and expires after 30 days. Until the partner joins, the initiator can make a
new link from the Benvolio's page, which replaces the old one.
