-- Benvolio conversations.
--
-- Writes happen only on the server, with the service role, after the
-- turn-taking rules in src/lib/conversation/model.ts have checked them. People
-- signed in through the browser can only read, and row-level security
-- enforces the core rule in the database itself: you see your partner's
-- writing for a sitting only once both of you have submitted it.

create type public.participant_role as enum ('initiator', 'recipient');
create type public.benvolio_pace as enum ('daily', 'weekly');
create type public.email_kind as enum ('invite', 'your_turn', 'reminder', 'finished');

-- Emails live only in auth.users.
create table public.people (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.benvolios (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 300),
  -- New wording the recipient suggested, waiting for the initiator.
  proposed_question text check (char_length(proposed_question) between 1 and 300),
  pace public.benvolio_pace not null default 'daily',
  created_at timestamptz not null default now()
);

create table public.participants (
  benvolio_id uuid not null references public.benvolios (id) on delete cascade,
  role public.participant_role not null,
  -- Null for the recipient until they accept the invite: that is what "joined" means.
  person_id uuid references public.people (id) on delete set null,
  -- Known before the recipient has an account, from the invite.
  first_name text not null check (char_length(first_name) between 1 and 60),
  primary key (benvolio_id, role)
);
-- Serves "my role in this Benvolio" and "my Benvolios".
create unique index participants_person on public.participants (person_id, benvolio_id);

-- The raw invite token is only ever in the invite email; we keep its hash.
create table public.invites (
  benvolio_id uuid primary key references public.benvolios (id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.submissions (
  benvolio_id uuid not null,
  sitting smallint not null check (sitting between 0 and 5),
  role public.participant_role not null,
  -- A Submission from model.ts, already parsed and validated.
  body jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (benvolio_id, sitting, role),
  foreign key (benvolio_id, role) references public.participants (benvolio_id, role) on delete cascade
);

-- A Benvolio is finished once both people have submitted sitting 5, so that is
-- derived from submissions rather than stored.

-- Every email sent, so reminders never double up.
create table public.notifications (
  id bigint generated always as identity primary key,
  benvolio_id uuid not null references public.benvolios (id) on delete cascade,
  role public.participant_role not null,
  kind public.email_kind not null,
  reminder_number smallint check (reminder_number between 1 and 3),
  sent_at timestamptz not null default now()
);
create index notifications_benvolio on public.notifications (benvolio_id, role, sent_at);

-- Read-only access for signed-in people; nothing for anonymous visitors.
alter table public.people enable row level security;
alter table public.benvolios enable row level security;
alter table public.participants enable row level security;
alter table public.invites enable row level security;
alter table public.submissions enable row level security;
alter table public.notifications enable row level security;

revoke all on public.people, public.benvolios, public.participants, public.invites,
  public.submissions, public.notifications from anon, authenticated;
grant select on public.people, public.benvolios, public.participants, public.submissions
  to authenticated;
grant all on public.people, public.benvolios, public.participants, public.invites,
  public.submissions, public.notifications to service_role;

-- The Benvolios the signed-in person is in. Used as `in (select ...)` so it runs
-- once per query, not once per row.
create function public.my_benvolio_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select benvolio_id from public.participants where person_id = (select auth.uid())
$$;

-- Whether the signed-in person may read a submission: always their own, and
-- their partner's once they have submitted that sitting too. This mirrors
-- isRevealed in src/lib/conversation/model.ts, which also holds the opening
-- while new wording is pending; the server never lets that state arise (the
-- recipient waits to write until the wording is settled), so it isn't repeated
-- here. src/lib/db/schema.test.ts checks the two agree.
create function public.can_read_submission(b uuid, s smallint, r public.participant_role)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants me
    where me.benvolio_id = b and me.person_id = (select auth.uid())
      and (
        me.role = r
        or exists (
          select 1 from public.submissions mine
          where mine.benvolio_id = b and mine.sitting = s and mine.role = me.role
        )
      )
  )
$$;

revoke all on function public.my_benvolio_ids(), public.can_read_submission(uuid, smallint, public.participant_role)
  from public, anon;
grant execute on function public.my_benvolio_ids(), public.can_read_submission(uuid, smallint, public.participant_role)
  to authenticated;

create policy "Read Benvolios you are in" on public.benvolios
  for select to authenticated using (id in (select public.my_benvolio_ids()));

-- Partners' first names come from here.
create policy "Read the people in your Benvolios" on public.participants
  for select to authenticated using (benvolio_id in (select public.my_benvolio_ids()));

create policy "Read yourself" on public.people
  for select to authenticated using (id = (select auth.uid()));

create policy "Read your own writing, and your partner's once you have written yours" on public.submissions
  for select to authenticated using (
    benvolio_id in (select public.my_benvolio_ids())
    and public.can_read_submission(benvolio_id, sitting, role)
  );
