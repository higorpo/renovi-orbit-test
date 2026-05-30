-- CNS Wave C — task 63: admin audit replay timeline (design §10.4; Req. 21, 28).
-- Depends on chat_audit / proposal_audit tables (task 9).

create or replace function public.get_negotiation_audit_timeline(p_service_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_items jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required for get_negotiation_audit_timeline'
      using errcode = '42501';
  end if;

  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED'
      using
        errcode = '42501',
        detail = jsonb_build_object('code', 'ADMIN_REQUIRED')::text;
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', e.source,
        'entity_id', e.entity_id,
        'chat_id', e.chat_id,
        'proposal_id', e.proposal_id,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'actor_id', e.actor_id,
        'metadata', e.metadata,
        'created_at', e.created_at,
        'audit_id', e.audit_id
      )
      order by e.created_at asc, e.audit_id asc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      'chat'::text as source,
      ca.chat_id as entity_id,
      ca.chat_id,
      null::uuid as proposal_id,
      ca.from_status::text as from_status,
      ca.to_status::text as to_status,
      ca.actor_id,
      ca.metadata,
      ca.created_at,
      ca.id as audit_id
    from public.chat_audit ca
    inner join public.chats c on c.id = ca.chat_id
    where c.service_request_id = p_service_request_id

    union all

    select
      'proposal'::text as source,
      pa.proposal_id as entity_id,
      pp.chat_id,
      pa.proposal_id,
      pa.from_status::text as from_status,
      pa.to_status::text as to_status,
      pa.actor_id,
      pa.metadata,
      pa.created_at,
      pa.id as audit_id
    from public.proposal_audit pa
    inner join public.provider_proposals pp on pp.id = pa.proposal_id
    where pp.service_request_id = p_service_request_id
  ) e;

  return jsonb_build_object(
    'service_request_id', p_service_request_id,
    'items', v_items
  );
end;
$$;

comment on function public.get_negotiation_audit_timeline(uuid) is
  'Admin-only merged chat/proposal audit timeline for support replay (R21-AC04, R28-AC06).';

revoke all on function public.get_negotiation_audit_timeline(uuid) from public;
revoke all on function public.get_negotiation_audit_timeline(uuid) from anon;
grant execute on function public.get_negotiation_audit_timeline(uuid) to authenticated;
