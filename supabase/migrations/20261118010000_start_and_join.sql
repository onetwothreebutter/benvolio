-- Starting a Benvolio and joining one from an invite each touch several
-- tables, so they run as one transaction in the database. Only the server
-- (service role) may call them, after checking who is signed in. Each refusal
-- has its own SQLSTATE, which src/lib/db/rpc-error.ts maps for the app.

create function public.start_benvolio(
  initiator uuid,
  question text,
  partner_first_name text,
  partner_email text,
  token_hash text,
  pace public.benvolio_pace default 'daily'
) returns uuid
language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  insert into public.benvolios (question, pace) values (question, pace) returning id into new_id;
  insert into public.participants (benvolio_id, role, person_id, first_name)
    select new_id, 'initiator', p.id, p.first_name from public.people p where p.id = initiator;
  if not found then
    raise exception 'no_profile' using errcode = 'BVPRO';
  end if;
  insert into public.participants (benvolio_id, role, first_name)
    values (new_id, 'recipient', partner_first_name);
  insert into public.invites (benvolio_id, token_hash, email)
    values (new_id, start_benvolio.token_hash, partner_email);
  return new_id;
end
$$;

-- Joins the invite's Benvolio as the recipient and uses up the invite. New
-- wording for the question, if any, waits for the initiator.
create function public.join_benvolio(
  token_hash text,
  recipient uuid,
  proposed_question text default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  b uuid;
begin
  select i.benvolio_id into b from public.invites i
    where i.token_hash = join_benvolio.token_hash and i.expires_at > now()
    for update;
  if b is null then
    raise exception 'invite_not_found' using errcode = 'BVINV';
  end if;
  if exists (
    select 1 from public.participants
    where benvolio_id = b and role = 'initiator' and person_id = recipient
  ) then
    raise exception 'own_invite' using errcode = 'BVOWN';
  end if;
  update public.participants pa set person_id = p.id, first_name = p.first_name
    from public.people p
    where pa.benvolio_id = b and pa.role = 'recipient' and pa.person_id is null and p.id = recipient;
  if not found then
    raise exception 'no_profile' using errcode = 'BVPRO';
  end if;
  update public.benvolios set proposed_question = join_benvolio.proposed_question where id = b;
  delete from public.invites where benvolio_id = b;
  return b;
end
$$;

revoke all on function public.start_benvolio(uuid, text, text, text, text, public.benvolio_pace),
  public.join_benvolio(text, uuid, text) from public, anon, authenticated;
grant execute on function public.start_benvolio(uuid, text, text, text, text, public.benvolio_pace),
  public.join_benvolio(text, uuid, text) to service_role;

-- A fresh invite link for a Benvolio the recipient hasn't joined yet, for when
-- the initiator lost the first one or it expired. The old link stops working.
-- Returns false if this person can't do that. It renews the existing invite
-- row, so a job that deletes expired invites must keep those whose recipient
-- hasn't joined (it should delete the whole unjoined Benvolio instead).
create function public.renew_invite(benvolio uuid, initiator uuid, token_hash text)
returns boolean
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.participants
    where benvolio_id = benvolio and role = 'initiator' and person_id = initiator
  ) or exists (
    select 1 from public.participants
    where benvolio_id = benvolio and role = 'recipient' and person_id is not null
  ) then
    return false;
  end if;
  update public.invites
    set token_hash = renew_invite.token_hash, expires_at = now() + interval '30 days'
    where benvolio_id = benvolio;
  return found;
end
$$;

revoke all on function public.renew_invite(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.renew_invite(uuid, uuid, text) to service_role;
