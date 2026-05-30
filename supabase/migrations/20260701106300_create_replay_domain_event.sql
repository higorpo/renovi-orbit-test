-- Platform outbox — task 69: dead-letter replay RPC (design §8.4; Req. 26, 28).
-- Depends on domain_events (task 7). Reclaimed by domain consumers (e.g. cns_process_domain_events).

drop function if exists public.cns_replay_domain_event(uuid);

create or replace function public.replay_domain_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_event public.domain_events%rowtype;
  v_updated public.domain_events%rowtype;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    v_actor_role := 'service_role';
  else
    v_actor_id := auth.uid();

    if v_actor_id is null then
      raise exception 'Authentication required for replay_domain_event'
        using errcode = '42501';
    end if;

    if not public.is_platform_admin() then
      raise exception 'ADMIN_REQUIRED'
        using
          errcode = '42501',
          detail = jsonb_build_object('code', 'ADMIN_REQUIRED')::text;
    end if;

    v_actor_role := 'admin';
  end if;

  if p_event_id is null then
    raise exception 'p_event_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_event
  from public.domain_events de
  where de.id = p_event_id;

  if not found then
    raise exception 'DOMAIN_EVENT_NOT_FOUND'
      using
        errcode = 'P0002',
        detail = jsonb_build_object(
          'code', 'DOMAIN_EVENT_NOT_FOUND',
          'event_id', p_event_id
        )::text;
  end if;

  if v_event.processed_at is not null then
    raise exception 'DOMAIN_EVENT_ALREADY_PROCESSED'
      using
        errcode = '22023',
        detail = jsonb_build_object(
          'code', 'DOMAIN_EVENT_ALREADY_PROCESSED',
          'event_id', p_event_id
        )::text;
  end if;

  if not v_event.dead_letter then
    raise exception 'DOMAIN_EVENT_NOT_DEAD_LETTER'
      using
        errcode = '22023',
        detail = jsonb_build_object(
          'code', 'DOMAIN_EVENT_NOT_DEAD_LETTER',
          'event_id', p_event_id
        )::text;
  end if;

  update public.domain_events
  set
    retry_count = 0,
    dead_letter = false,
    dead_letter_at = null,
    locked_until = null,
    locked_by = null,
    last_error = null
  where id = p_event_id
  returning * into v_updated;

  raise log 'domain_event_replay event_id=% event_type=% service_request_id=% actor_id=% actor_role=% prior_retry_count=% prior_dead_letter_at=%',
    v_updated.id,
    v_updated.event_type,
    v_updated.service_request_id,
    v_actor_id,
    v_actor_role,
    v_event.retry_count,
    v_event.dead_letter_at;

  return jsonb_build_object(
    'event_id', v_updated.id,
    'event_type', v_updated.event_type,
    'service_request_id', v_updated.service_request_id,
    'chat_id', v_updated.chat_id,
    'replay_actor_id', v_actor_id,
    'replay_actor_role', v_actor_role,
    'prior_retry_count', v_event.retry_count,
    'prior_dead_letter_at', v_event.dead_letter_at,
    'replayed_at', now()
  );
end;
$$;

comment on function public.replay_domain_event(uuid) is
  'Operator replay: reset dead-letter domain_events row for outbox consumer reprocessing. service_role or platform admin; downstream dedupe relies on stable idempotency_key (R26-AC05, §8.4).';

revoke all on function public.replay_domain_event(uuid) from public;
revoke all on function public.replay_domain_event(uuid) from anon;
grant execute on function public.replay_domain_event(uuid) to authenticated;
grant execute on function public.replay_domain_event(uuid) to service_role;
