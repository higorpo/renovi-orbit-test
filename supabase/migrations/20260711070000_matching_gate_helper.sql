-- Matching M8 — evaluate_service_request_dispatch_gates RPC (design §13.7).

create or replace function public.evaluate_service_request_dispatch_gates(p_service_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.service_request_dispatches%rowtype;
  v_pending int;
  v_active_chats int;
  v_slot_cap int;
  v_pause_threshold int;
  v_chat_window_hours int;
  v_new_status public.service_request_dispatch_status;
begin
  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = p_service_request_id
      and sr.status = 'OPEN'::public.service_request_status
  ) then
    return;
  end if;

  select *
  into v_d
  from public.service_request_dispatches d
  where d.service_request_id = p_service_request_id
  for update;

  if not found then
    return;
  end if;

  if v_d.status in (
    'DISPATCH_MATCHED',
    'DISPATCH_CANCELLED',
    'DISPATCH_EXPIRED'
  ) then
    return;
  end if;

  v_slot_cap := public.platform_constant_int('chats.max_active_slots_per_service_request', 4);
  v_pause_threshold := public.platform_constant_int('matching.dispatch_pause_active_chat_threshold', 10);
  v_chat_window_hours := public.platform_constant_int('matching.dispatch_active_chat_window_hours', 24);

  select count(*)::int
  into v_pending
  from public.provider_proposals pp
  where pp.service_request_id = p_service_request_id
    and pp.status in (
      'PENDING'::public.proposal_status,
      'REVISION_REQUESTED'::public.proposal_status
    );

  select count(*)::int
  into v_active_chats
  from public.chats c
  where c.service_request_id = p_service_request_id
    and c.status = 'ACTIVE'::public.cns_conversation_status
    and c.last_interaction_at >= now() - (v_chat_window_hours || ' hours')::interval
    and exists (
      select 1
      from public.chat_messages m
      where m.chat_id = c.id
    );

  if v_pending >= v_slot_cap then
    v_new_status := 'DISPATCH_STOPPED';
  elsif v_active_chats >= v_pause_threshold then
    v_new_status := 'DISPATCH_PAUSED';
  elsif v_d.fallback_opened_at is not null then
    v_new_status := 'DISPATCH_FALLBACK_OPEN_MARKET';
  elsif v_d.status = 'DISPATCH_PENDING'::public.service_request_dispatch_status then
    v_new_status := 'DISPATCH_PENDING';
  else
    v_new_status := 'DISPATCH_ACTIVE';
  end if;

  if v_new_status is distinct from v_d.status then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_d.id,
      p_service_request_id,
      'state_transition',
      jsonb_build_object('from', v_d.status, 'to', v_new_status)
    );

    update public.service_request_dispatches
    set
      status = v_new_status,
      next_batch_at = case
        when v_new_status in (
          'DISPATCH_STOPPED',
          'DISPATCH_PAUSED',
          'DISPATCH_FALLBACK_OPEN_MARKET'
        ) then null
        when v_new_status = 'DISPATCH_ACTIVE'::public.service_request_dispatch_status
          and v_d.status in (
            'DISPATCH_STOPPED'::public.service_request_dispatch_status,
            'DISPATCH_PAUSED'::public.service_request_dispatch_status
          ) then now()
        else next_batch_at
      end,
      updated_at = now()
    where id = v_d.id;
  end if;
end;
$$;

comment on function public.evaluate_service_request_dispatch_gates(uuid) is
  'Re-evaluates dispatch gate ladder (STOPPED > PAUSED > FALLBACK > ACTIVE/PENDING). RPC/cron only; never opens batches.';

revoke all on function public.evaluate_service_request_dispatch_gates(uuid)
  from public, anon, authenticated;
grant execute on function public.evaluate_service_request_dispatch_gates(uuid) to service_role;
