-- Service completion Task 11: extract matching_bootstrap_dispatch_for_service_request
-- from OPEN-insert trigger body (design §3.7). Delay semantics unchanged.

create or replace function public.matching_bootstrap_dispatch_for_service_request(
  p_service_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delay_minutes int;
  v_dispatch_id uuid;
begin
  -- Worker/cron only (finalize_ready / sweeper repair). Temporary OPEN trigger
  -- (dropped in Task 12) also calls here; after that path, callers always set service_role JWT.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for matching_bootstrap_dispatch_for_service_request'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  v_delay_minutes := public.platform_constant_int('matching.dispatch_start_delay_minutes', 5);

  insert into public.service_request_dispatches (
    service_request_id,
    status,
    next_batch_at
  )
  values (
    p_service_request_id,
    'DISPATCH_PENDING'::public.service_request_dispatch_status,
    now() + (v_delay_minutes || ' minutes')::interval
  )
  on conflict (service_request_id) do nothing
  returning id into v_dispatch_id;

  -- MUST NOT reset next_batch_at on conflict (ON CONFLICT DO NOTHING).

  if v_dispatch_id is not null then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_dispatch_id,
      p_service_request_id,
      'state_transition'::public.service_request_dispatch_event_type,
      jsonb_build_object('bootstrap', true, 'to', 'DISPATCH_PENDING')
    );
  end if;
end;
$$;

comment on function public.matching_bootstrap_dispatch_for_service_request(uuid) is
  'Matching-owned idempotent dispatch bootstrap: INSERT DISPATCH_PENDING with start delay; ON CONFLICT DO NOTHING (no next_batch_at reset). Called from enrichment_finalize_ready / sweeper; temporary OPEN trigger delegates here until Task 12 DROP.';

revoke all on function public.matching_bootstrap_dispatch_for_service_request(uuid)
  from public, anon, authenticated;
grant execute on function public.matching_bootstrap_dispatch_for_service_request(uuid)
  to service_role;

-- Delegate existing OPEN bootstrap trigger to the extracted RPC (behavior unchanged until Task 12).
create or replace function public.trg_fn_service_request_dispatch_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from 'OPEN'::public.service_request_status then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status is not distinct from 'OPEN'::public.service_request_status then
    return new;
  end if;

  perform public.matching_bootstrap_dispatch_for_service_request(new.id);
  return new;
end;
$$;

comment on function public.trg_fn_service_request_dispatch_bootstrap() is
  'AFTER INSERT/UPDATE on service_requests: bootstrap dispatch on first OPEN via matching_bootstrap_dispatch_for_service_request (Task 11 extract; DROP in Task 12).';
