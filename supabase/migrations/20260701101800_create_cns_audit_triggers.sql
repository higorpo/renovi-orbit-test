-- CNS Wave A — task 19: audit triggers on chats and provider_proposals status (design §3.11).

create or replace function public.audit_chat_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.status is distinct from new.status then
    insert into public.chat_audit (
      chat_id,
      from_status,
      to_status,
      actor_id,
      metadata
    )
    values (
      new.id,
      old.status,
      new.status,
      (select auth.uid()),
      jsonb_strip_nulls(
        jsonb_build_object(
          'closure_type', case when new.status = 'CLOSED' then new.closure_type end,
          'closure_reason', case when new.status = 'CLOSED' then new.closure_reason end,
          'closed_by_user_id', case when new.status = 'CLOSED' then new.closed_by_user_id end,
          'inactivation_reason', case when new.status = 'INACTIVE' then new.inactivation_reason end,
          'inactivated_at', case when new.status = 'INACTIVE' then new.inactivated_at end
        )
      )
    );
  end if;

  return new;
end;
$$;

comment on function public.audit_chat_status_change() is
  'AFTER UPDATE OF status on chats: append chat_audit row in same transaction (R21-AC01).';

create or replace function public.audit_proposal_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.status is distinct from new.status then
    insert into public.proposal_audit (
      proposal_id,
      from_status,
      to_status,
      actor_id,
      metadata
    )
    values (
      new.id,
      old.status,
      new.status,
      (select auth.uid()),
      jsonb_strip_nulls(
        jsonb_build_object(
          'chat_id', new.chat_id,
          'revision_reason', new.revision_reason,
          'revision_notes', new.revision_notes,
          'selected_slot', case when new.status = 'ACCEPTED' then new.selected_slot end
        )
      )
    );
  end if;

  return new;
end;
$$;

comment on function public.audit_proposal_status_change() is
  'AFTER UPDATE OF status on provider_proposals: append proposal_audit row in same transaction (R21-AC01).';

drop trigger if exists chats_audit_status_change on public.chats;

create trigger chats_audit_status_change
  after update of status on public.chats
  for each row execute function public.audit_chat_status_change();

drop trigger if exists provider_proposals_audit_status_change on public.provider_proposals;

create trigger provider_proposals_audit_status_change
  after update of status on public.provider_proposals
  for each row execute function public.audit_proposal_status_change();

revoke insert, update, delete on public.chat_audit from anon, authenticated;
revoke insert, update, delete on public.proposal_audit from anon, authenticated;
