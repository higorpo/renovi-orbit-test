-- Corrective migration: proposal audit trigger after chat_id column drop.

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
          'chat_id',
          public.resolve_proposal_chat_id(new.service_request_id, new.provider_id),
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
