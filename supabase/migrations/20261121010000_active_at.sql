-- When a Benvolio last moved: the daily check-in reminds whoever has had their
-- turn for a few quiet days. Sending a sitting, joining (which sets
-- proposed_question, even to null) and deciding on the question each count.
alter table public.benvolios add column active_at timestamptz not null default now();

-- For the check-in, which looks only at Benvolios quiet for a while.
create index benvolios_active_at on public.benvolios (active_at);

create function private.touch_benvolio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.benvolios set active_at = now() where id = new.benvolio_id;
  return null;
end
$$;
revoke all on function private.touch_benvolio() from public, anon, authenticated;
create trigger touch_benvolio_after_submission
  after insert on public.submissions
  for each row execute function private.touch_benvolio();

create function private.touch_question() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.active_at := now();
  return new;
end
$$;
revoke all on function private.touch_question() from public, anon, authenticated;
create trigger touch_benvolio_on_question
  before update of question, proposed_question on public.benvolios
  for each row execute function private.touch_question();
