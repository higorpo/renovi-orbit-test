-- CNS Wave B — task 25: authoritative free-messaging gate (design §4.2.1, Req. 34).
-- Migration order: runs AFTER task 17 (is_chat_participant) and task 14 (provider_proposals CNS).

create or replace function public.cns_chat_free_messaging_allowed(p_chat_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select public.is_chat_participant(p_chat_id))
    and not exists (
      select 1
      from public.provider_proposals pp
      where pp.chat_id = p_chat_id
        and pp.status = 'PENDING'::public.proposal_status
    );
$$;

comment on function public.cns_chat_free_messaging_allowed(uuid) is
  'Req. 34 gate: false when participant and a PENDING proposal exists; true on REVISION_REQUESTED (no PENDING). Non-participants always false (OAC-13).';

grant execute on function public.cns_chat_free_messaging_allowed(uuid) to authenticated;
