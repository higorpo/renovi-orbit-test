-- Payment Task 22: payment_revoke_client_card_token RPC (design.md §5.2, Req 28).

create or replace function public.payment_revoke_client_card_token(
  p_client_card_token_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.client_card_tokens%rowtype;
  v_blocked_schedules jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for payment_revoke_client_card_token'
      using errcode = '42501';
  end if;

  select *
  into v_token
  from public.client_card_tokens cct
  where cct.id = p_client_card_token_id
    and cct.client_id = auth.uid()
    and cct.state = 'ACTIVE'
  for update;

  if not found then
    raise exception 'CLIENT_CARD_TOKEN_NOT_FOUND'
      using
        errcode = 'P0002',
        detail = jsonb_build_object('code', 'CLIENT_CARD_TOKEN_NOT_FOUND')::text;
  end if;

  with blocked as (
    select
      ps.id,
      ps.contracted_service_id,
      ps.state,
      ps.created_at
    from public.payment_schedules ps
    where ps.client_card_token_id = p_client_card_token_id
      and ps.client_id = auth.uid()
      and ps.state in (
        'SCHEDULED'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'PROCESSING'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state
      )
    for update
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schedule_id', b.id,
        'contracted_service_id', b.contracted_service_id,
        'state', b.state
      )
      order by b.created_at desc
    ),
    '[]'::jsonb
  )
  into v_blocked_schedules
  from blocked b;

  if jsonb_array_length(v_blocked_schedules) > 0 then
    raise exception 'CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE',
          'schedules', v_blocked_schedules
        )::text;
  end if;

  update public.client_card_tokens cct
  set
    state = 'REVOKED',
    updated_at = now()
  where cct.id = p_client_card_token_id;

  perform public.payment_write_audit(
    p_event_type := 'CARD_TOKEN_REVOKED',
    p_entity_type := 'client_card_token',
    p_entity_id := p_client_card_token_id,
    p_from_state := 'ACTIVE',
    p_to_state := 'REVOKED',
    p_actor := 'client',
    p_actor_id := auth.uid()
  );

  return jsonb_build_object(
    'client_card_token_id', p_client_card_token_id,
    'state', 'REVOKED'
  );
end;
$$;

comment on function public.payment_revoke_client_card_token(uuid) is
  'Revokes an ACTIVE client card token when no charge-eligible schedules reference it.';

revoke all on function public.payment_revoke_client_card_token(uuid) from public;
revoke all on function public.payment_revoke_client_card_token(uuid) from anon;
revoke all on function public.payment_revoke_client_card_token(uuid) from service_role;

grant execute on function public.payment_revoke_client_card_token(uuid) to authenticated;
