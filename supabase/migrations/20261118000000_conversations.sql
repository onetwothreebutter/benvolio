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

-- Emails live in auth.users (and, before the recipient has an account, on
-- their invite). first_name here is the person's own; participants.first_name
-- is the name shown in a particular Benvolio and is set from it on joining.
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
  -- Null for the recipient until they accept the invite: that is what "joined"
  -- means. Deleting an account deletes its Benvolios (see the trigger below),
  -- so a null never means "left".
  person_id uuid references public.people (id) on delete cascade,
  -- Known before the recipient has an account, from the invite.
  first_name text not null check (char_length(first_name) between 1 and 60),
  primary key (benvolio_id, role),
  check (role = 'recipient' or person_id is not null)
);
-- Serves "my role in this Benvolio" and "my Benvolios".
create unique index participants_person on public.participants (person_id, benvolio_id);

-- The raw invite token is only ever in the invite email; we keep its hash.
-- The recipient's email is kept here because they have no account yet. The
-- row is deleted in the same transaction that sets their person_id on joining.
create table public.invites (
  benvolio_id uuid primary key references public.benvolios (id) on delete cascade,
  token_hash text not null unique,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
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

-- Every email sent. Insert with "on conflict do nothing" before sending: the
-- unique key means two overlapping reminder runs can never both send.
create table public.notifications (
  id bigint generated always as identity primary key,
  benvolio_id uuid not null references public.benvolios (id) on delete cascade,
  role public.participant_role not null,
  kind public.email_kind not null,
  -- The sitting the email is about (null for the invite and the finish email).
  sitting smallint check (sitting between 0 and 5),
  reminder_number smallint check (reminder_number between 1 and 3),
  sent_at timestamptz not null default now(),
  check ((kind = 'reminder') = (reminder_number is not null)),
  unique nulls not distinct (benvolio_id, role, kind, sitting, reminder_number)
);

-- Deleting an account deletes every Benvolio it was in, for both people: a
-- conversation can't carry on, or stay readable, with one side gone.
create function public.delete_benvolios_of_person() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.benvolios
  where id in (select benvolio_id from public.participants where person_id = old.id);
  return old;
end
$$;
revoke all on function public.delete_benvolios_of_person() from public, anon, authenticated;
create trigger delete_benvolios_before_person
  before delete on public.people
  for each row execute function public.delete_benvolios_of_person();

-- Read-only access for signed-in people; nothing for anonymous visitors.
alter table public.people enable row level security;
alter table public.benvolios enable row level security;
alter table public.participants enable row level security;
alter table public.invites enable row level security;
alter table public.submissions enable row level security;
alter table public.notifications enable row level security;

revoke all on public.people, public.benvolios, public.participants, public.invites,
  public.submissions, public.notifications from anon, authenticated;
revoke all on sequence public.notifications_id_seq from anon, authenticated;
grant select on public.people, public.benvolios, public.participants, public.submissions
  to authenticated;
grant all on public.people, public.benvolios, public.participants, public.invites,
  public.submissions, public.notifications to service_role;

-- Helpers for the policies live outside the public schema, so they are not
-- exposed as API endpoints.
create schema private;
grant usage on schema private to authenticated;

-- The Benvolios the signed-in person is in. Used as `in (select ...)` so it runs
-- once per query, not once per row.
create function private.my_benvolio_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select benvolio_id from public.participants where person_id = (select auth.uid())
$$;

-- Whether the signed-in person may read a submission: always their own, and
-- their partner's once they have submitted that sitting too, except the
-- opening while new wording for the question is pending. This mirrors
-- isRevealed in src/lib/conversation/model.ts; src/lib/db/schema.test.ts
-- checks the two agree.
create function private.can_read_submission(b uuid, s smallint, r public.participant_role)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants me
    where me.benvolio_id = b and me.person_id = (select auth.uid())
      and (
        me.role = r
        or (
          exists (
            select 1 from public.submissions mine
            where mine.benvolio_id = b and mine.sitting = s and mine.role = me.role
          )
          and (s > 0 or (select proposed_question is null from public.benvolios where id = b))
        )
      )
  )
$$;

revoke all on function private.my_benvolio_ids(), private.can_read_submission(uuid, smallint, public.participant_role)
  from public, anon;
grant execute on function private.my_benvolio_ids(), private.can_read_submission(uuid, smallint, public.participant_role)
  to authenticated;

create policy "Read Benvolios you are in" on public.benvolios
  for select to authenticated using (id in (select private.my_benvolio_ids()));

-- Partners' first names come from here.
create policy "Read the people in your Benvolios" on public.participants
  for select to authenticated using (benvolio_id in (select private.my_benvolio_ids()));

create policy "Read yourself" on public.people
  for select to authenticated using (id = (select auth.uid()));

create policy "Read your own writing, and your partner's once you have written yours" on public.submissions
  for select to authenticated using (
    benvolio_id in (select private.my_benvolio_ids())
    and private.can_read_submission(benvolio_id, sitting, role)
  );
