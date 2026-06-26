-- Payment Task 50: payment_reconstruct_audit_lifecycle RPC (design.md §8.3, Req 22).

create or replace function public.payment_reconstruct_audit_lifecycle(
  p_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_reconstruct_audit_lifecycle'
      using errcode = '42501';
  end if;

  if p_service_id is null then
    raise exception 'p_service_id is required'
      using errcode = '22023';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', pal.id,
          'created_at', pal.created_at,
          'event_type', pal.event_type,
          'entity_type', pal.entity_type,
          'entity_id', pal.entity_id,
          'service_id', pal.service_id,
          'schedule_id', pal.schedule_id,
          'from_state', pal.from_state,
          'to_state', pal.to_state,
          'actor', pal.actor,
          'actor_id', pal.actor_id,
          'metadata', pal.metadata
        )
        order by pal.created_at asc, pal.id asc
      )
      from public.payment_audit_log pal
      where pal.service_id = p_service_id
         or pal.schedule_id in (
           select ps.id
           from public.payment_schedules ps
           where ps.contracted_service_id = p_service_id
         )
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function public.payment_reconstruct_audit_lifecycle(uuid) is
  'Operator diagnostic: chronological payment_audit_log for a contracted service (service_role only).';

revoke all on function public.payment_reconstruct_audit_lifecycle(uuid) from public;
revoke all on function public.payment_reconstruct_audit_lifecycle(uuid) from anon;
revoke all on function public.payment_reconstruct_audit_lifecycle(uuid) from authenticated;

grant execute on function public.payment_reconstruct_audit_lifecycle(uuid) to service_role;
