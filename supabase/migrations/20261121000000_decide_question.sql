-- The initiator accepts or keeps the recipient's new wording for the question.
-- Accepting makes it the question and reopens the initiator's opening, so their
-- stance answers the question as it now stands; this mirrors decideQuestion in
-- src/lib/conversation/model.ts. The recipient can't have written yet, since
-- they wait while wording is pending. Only the server (service role) may call
-- it, after checking who is signed in. Returns false if there is nothing for
-- this person to decide: they aren't the initiator, or it's already decided.
create function public.decide_question(benvolio uuid, initiator uuid, accept boolean)
returns boolean
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.participants
    where benvolio_id = benvolio and role = 'initiator' and person_id = initiator
  ) then
    return false;
  end if;
  update public.benvolios
    set question = case when accept then proposed_question else question end,
      proposed_question = null
    where id = benvolio and proposed_question is not null;
  if not found then
    return false;
  end if;
  if accept then
    delete from public.submissions where benvolio_id = benvolio and sitting = 0;
  end if;
  return true;
end
$$;

revoke all on function public.decide_question(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.decide_question(uuid, uuid, boolean) to service_role;
