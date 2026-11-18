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
  created_at timestamptz not null default now(),
  paused_at timestamptz,
  finished_at timestamptz
);

create table public.participants (
  benvolio_id uuid not null references public.benvolios (id) on delete cascade,
  role public.participant_role not null,
  -- Null for the recipient until they accept the invite.
  person_id uuid references public.people (id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  joined_at timestamptz,
  primary key (benvolio_id, role)
);
create unique index participants_person_once on public.participants (benvolio_id, person_id);
create index participants_person on public.participants (person_id);

-- The raw invite token is only ever in the invite email; we keep its hash.
create table public.invites (
  benvolio_id uuid primary key references public.benvolios (id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
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

-- The signed-in person's role in a Benvolio, or null if they are not in it.
create function public.my_role(b uuid) returns public.participant_role
language sql stable security definer set search_path = '' as $$
  select role from public.participants where benvolio_id = b and person_id = auth.uid()
$$;

-- True once both people have submitted a sitting. The opening (sitting 0)
-- also waits while new wording for the question is pending.
create function public.is_revealed(b uuid, s smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.submissions where benvolio_id = b and sitting = s) = 2
    and (s > 0 or (select proposed_question is null from public.benvolios where id = b))
$$;

revoke all on function public.my_role(uuid), public.is_revealed(uuid, smallint) from public, anon;
grant execute on function public.my_role(uuid), public.is_revealed(uuid, smallint) to authenticated;

create policy "Read Benvolios you are in" on public.benvolios
  for select to authenticated using (public.my_role(id) is not null);

create policy "Read the people in your Benvolios" on public.participants
  for select to authenticated using (public.my_role(benvolio_id) is not null);

create policy "Read yourself and your partners" on public.people
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from public.participants p
      where p.person_id = people.id and public.my_role(p.benvolio_id) is not null
    )
  );

create policy "Read your own writing, and your partner's once revealed" on public.submissions
  for select to authenticated using (
    role = public.my_role(benvolio_id)
    or (public.my_role(benvolio_id) is not null and public.is_revealed(benvolio_id, sitting))
  );
