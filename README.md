# Benvolio

Benvolio helps two people with different opinions understand each other through a
structured conversation. Each person writes privately, then both see the other's
answers at the same moment, over five rounds: Reasons, Questions, Sharing, Accord
and Compromise.

This version is a mobile-first web app where the two people take turns over days,
each on their own phone.

## Development

Requires Node 22 (see `.nvmrc`).

```sh
cp .env.example .env.local   # then add SUPABASE_SECRET_KEY
npm ci
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run lint
npm run typecheck
```

## Repository layout

- `src/` – the Next.js app
- `supabase/` – database migrations
- `legacy/elm-prototype-2017/` – the earlier Elm prototype, kept for reference

## Database

The schema is in `supabase/migrations/`, applied with the Supabase CLI
(`supabase db push`). Browsers can only read, and row-level security keeps a
partner's writing hidden until both people have submitted a sitting. All writes
go through the server. `src/lib/db/schema.test.ts` runs the migrations in PGlite
(Postgres in WebAssembly) and checks these rules, so no database is needed for
`npm test`.

## Sign-in

Email codes through Supabase Auth. See `docs/auth.md` for the dashboard
settings (redirect URLs, email template, SMTP) and environment variables.

## Deploying

The app runs on Vercel at `https://benvolio.app`, with functions in `pdx1`
next to the Supabase database (us-west-2).

1. In Vercel, add the domain `benvolio.app` (and `www.benvolio.app`, redirecting
   to it), then create the DNS records Vercel lists.
2. Set the environment variables from `.env.example`. `SUPABASE_SECRET_KEY` is
   secret; the others are public.
3. Apply the Supabase dashboard settings in `docs/auth.md`. Email is sent
   through Resend from `mail.benvolio.app`.
