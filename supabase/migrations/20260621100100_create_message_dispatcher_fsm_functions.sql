-- Multichannel Message Dispatcher (MMD) — migration 2 of 4 (design §13.1).
-- Wave W0: FSM matrix, transition trigger, ingest/cancel/checkout/report RPCs (tasks 11+ in docs/message-dispatcher/tasks.md).

-- FSM transition matrix (design §4.8, task 11). Authoritative guard for trigger and RPC assertions.
-- PROCESSING→QUEUED is allowed only on janitor/reclaim paths (§4.9), not on worker success completion.
create or replace function message_dispatcher.message_dispatch_status_allowed(
  p_from message_dispatcher.message_dispatch_status,
  p_to message_dispatcher.message_dispatch_status
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when p_from in ('DELIVERED', 'CANCELED', 'FAILED_TERMINAL') then false
    when p_from = 'PENDING_EVALUATION'
      and p_to in ('SCHEDULED', 'QUEUED', 'CANCELED', 'FAILED_TERMINAL') then true
    when p_from = 'SCHEDULED'
      and p_to in ('PENDING_EVALUATION', 'QUEUED', 'CANCELED', 'FAILED_TERMINAL') then true
    when p_from = 'QUEUED'
      and p_to in ('PROCESSING', 'CANCELED', 'FAILED_TERMINAL') then true
    when p_from = 'PROCESSING'
      and p_to in ('QUEUED', 'DELIVERED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL') then true
    when p_from = 'FAILED_RETRYABLE'
      and p_to in ('QUEUED', 'CANCELED', 'FAILED_TERMINAL') then true
    else false
  end;
$$;

comment on function message_dispatcher.message_dispatch_status_allowed(
  message_dispatcher.message_dispatch_status,
  message_dispatcher.message_dispatch_status
) is
  'Static FSM matrix (design §4.8). PROCESSING→QUEUED is for lease reclaim/janitor only, not worker DELIVERED path.';

grant execute on function message_dispatcher.message_dispatch_status_allowed(
  message_dispatcher.message_dispatch_status,
  message_dispatcher.message_dispatch_status
) to service_role;

-- FSM row guard (design §3.3.1, task 12). Rolls back illegal status changes before audit trigger fires.
create or replace function message_dispatcher.message_dispatches_validate_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not message_dispatcher.message_dispatch_status_allowed(old.status, new.status) then
      raise exception 'invalid status transition: % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function message_dispatcher.message_dispatches_validate_transition() is
  'BEFORE UPDATE guard on message_dispatches.status; uses message_dispatch_status_allowed (§4.8).';

drop trigger if exists message_dispatches_validate_transition
  on message_dispatcher.message_dispatches;

create trigger message_dispatches_validate_transition
  before update of status on message_dispatcher.message_dispatches
  for each row
  execute function message_dispatcher.message_dispatches_validate_transition();

-- Ingest RPC (design §5.1). Body extended in tasks 22–29; task 21: reject NULL idempotency key.
create or replace function message_dispatcher.message_dispatcher_ingest(
  p_idempotency_key uuid,
  p_profile_id uuid,
  p_channel message_dispatcher.message_channel,
  p_template_key text,
  p_template_variables jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now(),
  p_source_system text default 'orbit',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_existing message_dispatcher.message_dispatches%rowtype;
  v_limits message_dispatcher.message_dispatcher_user_limits%rowtype;
  v_email_limit integer;
  v_email_count integer;
  v_push_limit integer;
  v_push_count integer;
  v_push_cooldown_minutes integer;
  v_cooldown_until timestamptz;
  v_dispatch_id uuid;
  v_dispatch_status message_dispatcher.message_dispatch_status;
  v_dispatch_scheduled timestamptz;
  v_rate_limit_meta jsonb;
  v_dispatch_metadata jsonb;
begin
  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from message_dispatcher.message_dispatches d
  where d.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'dispatch_id', v_existing.id,
      'status', v_existing.status,
      'scheduled_for', v_existing.scheduled_for,
      'duplicate', true
    );
  end if;

  -- Serialize quota evaluation per profile (design §3.4, §7.2; Req. 1 AC3). Lock before any dispatch INSERT.
  insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
  values (p_profile_id)
  on conflict (profile_id) do nothing;

  select *
  into v_limits
  from message_dispatcher.message_dispatcher_user_limits ul
  where ul.profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'user_limits row missing for profile %', p_profile_id
      using errcode = 'P0001';
  end if;

  if nullif(trim(p_template_key), '') is null then
    raise exception 'p_template_key is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = p_template_key
      and t.channel = p_channel
      and t.active = true
  ) then
    raise exception 'unknown or inactive template: % for channel %', p_template_key, p_channel
      using errcode = '22023';
  end if;

  if octet_length(coalesce(p_template_variables, '{}'::jsonb)::text) > 8192 then
    raise exception 'template_variables exceeds 8192 bytes'
      using errcode = '22023';
  end if;

  if p_channel = 'email' then
    select coalesce((pc.value #>> '{}')::integer, 5)
    into v_email_limit
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.email_daily_limit';

    v_email_limit := coalesce(v_email_limit, 5);

    select count(*)::integer
    into v_email_count
    from message_dispatcher.message_dispatches d
    where d.profile_id = p_profile_id
      and d.channel = 'email'
      and d.status in ('DELIVERED', 'QUEUED', 'PROCESSING', 'SCHEDULED')
      and d.created_at > now() - interval '24 hours';

    if v_email_count >= v_email_limit then
      v_rate_limit_meta := jsonb_build_object(
        'channel', 'email',
        'limit', v_email_limit,
        'count_in_window', v_email_count,
        'window_hours', 24
      );
      v_dispatch_metadata := coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('rate_limit', v_rate_limit_meta);

      insert into message_dispatcher.message_dispatches (
        idempotency_key,
        profile_id,
        channel,
        template_key,
        template_variables,
        status,
        scheduled_for,
        source_system,
        metadata,
        failure_code,
        failure_reason
      )
      values (
        p_idempotency_key,
        p_profile_id,
        p_channel,
        p_template_key,
        coalesce(p_template_variables, '{}'::jsonb),
        'FAILED_TERMINAL',
        coalesce(p_scheduled_for, now()),
        coalesce(nullif(trim(p_source_system), ''), 'orbit'),
        v_dispatch_metadata,
        'email_daily_quota_exceeded',
        'Email daily quota exceeded'
      )
      returning id, status, scheduled_for
      into v_dispatch_id, v_dispatch_status, v_dispatch_scheduled;

      return jsonb_build_object(
        'dispatch_id', v_dispatch_id,
        'status', v_dispatch_status,
        'scheduled_for', v_dispatch_scheduled,
        'duplicate', false
      );
    end if;
  end if;

  if p_channel = 'push' then
    select coalesce((pc.value #>> '{}')::integer, 20)
    into v_push_limit
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.push_daily_limit';

    v_push_limit := coalesce(v_push_limit, 20);

    select count(*)::integer
    into v_push_count
    from message_dispatcher.message_dispatches d
    where d.profile_id = p_profile_id
      and d.channel = 'push'
      and d.status in ('DELIVERED', 'QUEUED', 'PROCESSING', 'SCHEDULED')
      and d.created_at > now() - interval '24 hours';

    if v_push_count >= v_push_limit then
      v_rate_limit_meta := jsonb_build_object(
        'channel', 'push',
        'limit', v_push_limit,
        'count_in_window', v_push_count,
        'window_hours', 24
      );
      v_dispatch_metadata := coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('rate_limit', v_rate_limit_meta);

      insert into message_dispatcher.message_dispatches (
        idempotency_key,
        profile_id,
        channel,
        template_key,
        template_variables,
        status,
        scheduled_for,
        source_system,
        metadata,
        failure_code,
        failure_reason
      )
      values (
        p_idempotency_key,
        p_profile_id,
        p_channel,
        p_template_key,
        coalesce(p_template_variables, '{}'::jsonb),
        'FAILED_TERMINAL',
        coalesce(p_scheduled_for, now()),
        coalesce(nullif(trim(p_source_system), ''), 'orbit'),
        v_dispatch_metadata,
        'push_daily_quota_exceeded',
        'Push daily quota exceeded'
      )
      returning id, status, scheduled_for
      into v_dispatch_id, v_dispatch_status, v_dispatch_scheduled;

      return jsonb_build_object(
        'dispatch_id', v_dispatch_id,
        'status', v_dispatch_status,
        'scheduled_for', v_dispatch_scheduled,
        'duplicate', false
      );
    end if;

    select coalesce((pc.value #>> '{}')::integer, 20)
    into v_push_cooldown_minutes
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.push_cooldown_minutes';

    v_push_cooldown_minutes := coalesce(v_push_cooldown_minutes, 20);

    if v_limits.last_push_sent_at is not null
      and now() < v_limits.last_push_sent_at + make_interval(mins => v_push_cooldown_minutes)
    then
      v_cooldown_until := v_limits.last_push_sent_at + make_interval(mins => v_push_cooldown_minutes);

      insert into message_dispatcher.message_dispatches (
        idempotency_key,
        profile_id,
        channel,
        template_key,
        template_variables,
        status,
        scheduled_for,
        source_system,
        metadata
      )
      values (
        p_idempotency_key,
        p_profile_id,
        p_channel,
        p_template_key,
        coalesce(p_template_variables, '{}'::jsonb),
        'SCHEDULED',
        v_cooldown_until,
        coalesce(nullif(trim(p_source_system), ''), 'orbit'),
        coalesce(p_metadata, '{}'::jsonb)
      )
      returning id, status, scheduled_for
      into v_dispatch_id, v_dispatch_status, v_dispatch_scheduled;

      return jsonb_build_object(
        'dispatch_id', v_dispatch_id,
        'status', v_dispatch_status,
        'scheduled_for', v_dispatch_scheduled,
        'duplicate', false
      );
    end if;
  end if;

  v_dispatch_scheduled := coalesce(p_scheduled_for, now());

  if v_dispatch_scheduled > now() then
    v_dispatch_status := 'SCHEDULED';
  else
    v_dispatch_status := 'QUEUED';
  end if;

  insert into message_dispatcher.message_dispatches (
    idempotency_key,
    profile_id,
    channel,
    template_key,
    template_variables,
    status,
    scheduled_for,
    source_system,
    metadata
  )
  values (
    p_idempotency_key,
    p_profile_id,
    p_channel,
    p_template_key,
    coalesce(p_template_variables, '{}'::jsonb),
    v_dispatch_status,
    v_dispatch_scheduled,
    coalesce(nullif(trim(p_source_system), ''), 'orbit'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id, status, scheduled_for
  into v_dispatch_id, v_dispatch_status, v_dispatch_scheduled;

  return jsonb_build_object(
    'dispatch_id', v_dispatch_id,
    'status', v_dispatch_status,
    'scheduled_for', v_dispatch_scheduled,
    'duplicate', false
  );
exception
  when unique_violation then
    select *
    into v_existing
    from message_dispatcher.message_dispatches d
    where d.idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'dispatch_id', v_existing.id,
        'status', v_existing.status,
        'scheduled_for', v_existing.scheduled_for,
        'duplicate', true
      );
    end if;

    raise;
end;
$$;

comment on function message_dispatcher.message_dispatcher_ingest(
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb
) is
  'Ingest dispatch intent (design §5.1). SECURITY DEFINER; service_role only. NULL p_idempotency_key → 22023; UNIQUE race → duplicate replay.';

revoke all on function message_dispatcher.message_dispatcher_ingest(
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb
) from public;

revoke all on function message_dispatcher.message_dispatcher_ingest(
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb
) from authenticated;

revoke all on function message_dispatcher.message_dispatcher_ingest(
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb
) from anon;

grant execute on function message_dispatcher.message_dispatcher_ingest(
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb
) to service_role;

-- Cancel RPC (design §5.2, §4.7). Task 30: cancelable states; task 31: 409 on PROCESSING/DELIVERED.
create or replace function message_dispatcher.message_dispatcher_cancel(
  p_dispatch_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_dispatch message_dispatcher.message_dispatches%rowtype;
begin
  if p_dispatch_id is null then
    raise exception 'p_dispatch_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_dispatch
  from message_dispatcher.message_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    raise exception 'dispatch not found: %', p_dispatch_id
      using errcode = 'P0001';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and (select auth.uid()) is distinct from v_dispatch.profile_id
  then
    raise exception 'not authorized to cancel this dispatch'
      using errcode = '42501';
  end if;

  if v_dispatch.status = 'CANCELED' then
    return jsonb_build_object(
      'dispatch_id', v_dispatch.id,
      'status', 'CANCELED'
    );
  end if;

  if v_dispatch.status in (
    'PENDING_EVALUATION',
    'SCHEDULED',
    'QUEUED',
    'FAILED_RETRYABLE'
  ) then
    update message_dispatcher.message_dispatches d
    set
      status = 'CANCELED',
      cancel_reason = coalesce(nullif(trim(p_reason), ''), 'canceled'),
      updated_at = now()
    where d.id = p_dispatch_id;

    return jsonb_build_object(
      'dispatch_id', p_dispatch_id,
      'status', 'CANCELED'
    );
  end if;

  if v_dispatch.status in ('PROCESSING', 'DELIVERED') then
    raise exception 'cannot cancel dispatch in status %', v_dispatch.status
      using errcode = '40901';
  end if;

  raise exception 'cannot cancel dispatch in status %', v_dispatch.status
    using errcode = 'P0001';
end;
$$;

comment on function message_dispatcher.message_dispatcher_cancel(uuid, text) is
  'Cancel dispatch (§4.7). Caller: service_role or owner profile_id. PROCESSING/DELIVERED → 40901.';

revoke all on function message_dispatcher.message_dispatcher_cancel(uuid, text) from public;
revoke all on function message_dispatcher.message_dispatcher_cancel(uuid, text) from anon;

grant execute on function message_dispatcher.message_dispatcher_cancel(uuid, text) to authenticated;
grant execute on function message_dispatcher.message_dispatcher_cancel(uuid, text) to service_role;

-- Cron: activate due SCHEDULED dispatches (design §4.2, task 33). Task 34 adds evaluate_pending in same txn.
create or replace function message_dispatcher.message_dispatcher_activate_scheduled()
returns integer
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_activated integer;
begin
  with candidates as (
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'SCHEDULED'
      and d.scheduled_for <= now()
    order by d.scheduled_for, d.created_at
    limit 500
    for update of d skip locked
  )
  update message_dispatcher.message_dispatches d
  set
    status = 'PENDING_EVALUATION',
    updated_at = now()
  from candidates c
  where d.id = c.id;

  get diagnostics v_activated = row_count;
  perform message_dispatcher.message_dispatcher_evaluate_pending();
  return coalesce(v_activated, 0);
end;
$$;

comment on function message_dispatcher.message_dispatcher_activate_scheduled() is
  'Cron RPC: due SCHEDULED → PENDING_EVALUATION, then evaluate_pending → QUEUED/terminal.';

-- Re-run ingest eligibility for PENDING_EVALUATION rows (design §4.2, task 34).
create or replace function message_dispatcher.message_dispatcher_evaluate_pending()
returns integer
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_email_limit integer;
  v_push_limit integer;
  v_push_cooldown_minutes integer;
  v_evaluated integer := 0;
  v_terminal_email integer := 0;
  v_terminal_push integer := 0;
  v_cooldown_push integer := 0;
  v_queued integer := 0;
  v_scheduled integer := 0;
begin
  -- Read limits once
  select coalesce((pc.value #>> '{}')::integer, 5)
  into v_email_limit
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.email_daily_limit';
  v_email_limit := coalesce(v_email_limit, 5);

  select coalesce((pc.value #>> '{}')::integer, 20)
  into v_push_limit
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.push_daily_limit';
  v_push_limit := coalesce(v_push_limit, 20);

  select coalesce((pc.value #>> '{}')::integer, 20)
  into v_push_cooldown_minutes
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.push_cooldown_minutes';
  v_push_cooldown_minutes := coalesce(v_push_cooldown_minutes, 20);

  -- Ensure user_limits rows exist for all profiles in the pending batch
  insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
  select distinct d.profile_id
  from message_dispatcher.message_dispatches d
  where d.status = 'PENDING_EVALUATION'
  on conflict (profile_id) do nothing;

  -- Email quota exceeded → FAILED_TERMINAL (set-based)
  with pending_email as (
    select d.id, d.profile_id, d.created_at
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'email'
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  quota as (
    select
      pe.id,
      pe.profile_id,
      (
        select count(*)::integer
        from message_dispatcher.message_dispatches dx
        where dx.profile_id = pe.profile_id
          and dx.channel = 'email'
          and dx.status in ('DELIVERED', 'QUEUED', 'PROCESSING', 'SCHEDULED')
          and dx.created_at > now() - interval '24 hours'
          and dx.id <> pe.id
      ) + (
        -- Count earlier pending siblings to preserve sequential quota semantics
        select count(*)::integer
        from pending_email earlier
        where earlier.profile_id = pe.profile_id
          and earlier.created_at < pe.created_at
      ) as email_count
    from pending_email pe
  ),
  over_quota as (
    select q.id, q.profile_id, q.email_count
    from quota q
    where q.email_count >= v_email_limit
  ),
  terminated as (
    update message_dispatcher.message_dispatches d
    set
      status = 'FAILED_TERMINAL',
      failure_code = 'email_daily_quota_exceeded',
      failure_reason = 'Email daily quota exceeded',
      metadata = coalesce(d.metadata, '{}'::jsonb)
        || jsonb_build_object('rate_limit', jsonb_build_object(
          'channel', 'email',
          'limit', v_email_limit,
          'count_in_window', oq.email_count,
          'window_hours', 24
        )),
      updated_at = now()
    from over_quota oq
    where d.id = oq.id
    returning d.id
  )
  select count(*) into v_terminal_email from terminated;

  -- Push quota exceeded → FAILED_TERMINAL (set-based)
  with pending_push as (
    select d.id, d.profile_id, d.created_at
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'push'
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  quota as (
    select
      pp.id,
      pp.profile_id,
      (
        select count(*)::integer
        from message_dispatcher.message_dispatches dx
        where dx.profile_id = pp.profile_id
          and dx.channel = 'push'
          and dx.status in ('DELIVERED', 'QUEUED', 'PROCESSING', 'SCHEDULED')
          and dx.created_at > now() - interval '24 hours'
          and dx.id <> pp.id
      ) + (
        -- Count earlier pending siblings to preserve sequential quota semantics
        select count(*)::integer
        from pending_push earlier
        where earlier.profile_id = pp.profile_id
          and earlier.created_at < pp.created_at
      ) as push_count
    from pending_push pp
  ),
  over_quota as (
    select q.id, q.profile_id, q.push_count
    from quota q
    where q.push_count >= v_push_limit
  ),
  terminated as (
    update message_dispatcher.message_dispatches d
    set
      status = 'FAILED_TERMINAL',
      failure_code = 'push_daily_quota_exceeded',
      failure_reason = 'Push daily quota exceeded',
      metadata = coalesce(d.metadata, '{}'::jsonb)
        || jsonb_build_object('rate_limit', jsonb_build_object(
          'channel', 'push',
          'limit', v_push_limit,
          'count_in_window', oq.push_count,
          'window_hours', 24
        )),
      updated_at = now()
    from over_quota oq
    where d.id = oq.id
    returning d.id
  )
  select count(*) into v_terminal_push from terminated;

  -- Push cooldown → SCHEDULED at cooldown_until (set-based)
  with pending_push_cooldown as (
    select d.id, d.profile_id, ul.last_push_sent_at
    from message_dispatcher.message_dispatches d
    join message_dispatcher.message_dispatcher_user_limits ul
      on ul.profile_id = d.profile_id
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'push'
      and ul.last_push_sent_at is not null
      and now() < ul.last_push_sent_at + make_interval(mins => v_push_cooldown_minutes)
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  rescheduled as (
    update message_dispatcher.message_dispatches d
    set
      status = 'SCHEDULED',
      scheduled_for = ppc.last_push_sent_at + make_interval(mins => v_push_cooldown_minutes),
      updated_at = now()
    from pending_push_cooldown ppc
    where d.id = ppc.id
    returning d.id
  )
  select count(*) into v_cooldown_push from rescheduled;

  -- Remaining: future scheduled_for → SCHEDULED, else → QUEUED
  with remaining_future as (
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
      and d.scheduled_for > now()
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  kept_scheduled as (
    update message_dispatcher.message_dispatches d
    set
      status = 'SCHEDULED',
      updated_at = now()
    from remaining_future rf
    where d.id = rf.id
    returning d.id
  )
  select count(*) into v_scheduled from kept_scheduled;

  -- Everything else PENDING_EVALUATION → QUEUED
  with remaining as (
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  moved_to_queued as (
    update message_dispatcher.message_dispatches d
    set
      status = 'QUEUED',
      updated_at = now()
    from remaining r
    where d.id = r.id
    returning d.id
  )
  select count(*) into v_queued from moved_to_queued;

  v_evaluated := v_terminal_email + v_terminal_push + v_cooldown_push + v_scheduled + v_queued;
  return v_evaluated;
end;
$$;

comment on function message_dispatcher.message_dispatcher_evaluate_pending() is
  'Cron subroutine: PENDING_EVALUATION → QUEUED, SCHEDULED, or terminal per ingest rules.';

revoke all on function message_dispatcher.message_dispatcher_evaluate_pending() from public;
revoke all on function message_dispatcher.message_dispatcher_evaluate_pending() from authenticated;
revoke all on function message_dispatcher.message_dispatcher_evaluate_pending() from anon;

grant execute on function message_dispatcher.message_dispatcher_evaluate_pending() to service_role;

revoke all on function message_dispatcher.message_dispatcher_activate_scheduled() from public;
revoke all on function message_dispatcher.message_dispatcher_activate_scheduled() from authenticated;
revoke all on function message_dispatcher.message_dispatcher_activate_scheduled() from anon;

grant execute on function message_dispatcher.message_dispatcher_activate_scheduled() to service_role;

-- Exponential backoff schedule (design §4.6, task 36). next_retry_at = now() + power(2, retry_count) * base seconds.
create or replace function message_dispatcher.message_dispatcher_compute_next_retry_at(
  p_retry_count integer
)
returns timestamptz
language sql
stable
as $$
  select now() + (
    power(2, greatest(coalesce(p_retry_count, 0), 0))::double precision
    * coalesce(
      (
        select (pc.value #>> '{}')::integer
        from public.platform_constants pc
        where pc.key = 'message_dispatcher.backoff_base_seconds'
      ),
      60
    )
    * interval '1 second'
  );
$$;

comment on function message_dispatcher.message_dispatcher_compute_next_retry_at(integer) is
  'Backoff: now() + power(2, retry_count) * backoff_base_seconds (default 60).';

grant execute on function message_dispatcher.message_dispatcher_compute_next_retry_at(integer) to service_role;

-- Cron: promote due FAILED_RETRYABLE dispatches to QUEUED (design §4.6, task 35).
create or replace function message_dispatcher.message_dispatcher_promote_retries()
returns integer
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_promoted integer;
begin
  with candidates as (
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'FAILED_RETRYABLE'
      and d.next_retry_at is not null
      and d.next_retry_at <= now()
    order by d.next_retry_at, d.created_at
    limit 500
    for update of d skip locked
  )
  update message_dispatcher.message_dispatches d
  set
    status = 'QUEUED',
    locked_until = null,
    locked_by = null,
    updated_at = now()
  from candidates c
  where d.id = c.id;

  get diagnostics v_promoted = row_count;
  return coalesce(v_promoted, 0);
end;
$$;

comment on function message_dispatcher.message_dispatcher_promote_retries() is
  'Cron RPC: FAILED_RETRYABLE with next_retry_at <= now() → QUEUED (batch 500, SKIP LOCKED).';

revoke all on function message_dispatcher.message_dispatcher_promote_retries() from public;
revoke all on function message_dispatcher.message_dispatcher_promote_retries() from authenticated;
revoke all on function message_dispatcher.message_dispatcher_promote_retries() from anon;

grant execute on function message_dispatcher.message_dispatcher_promote_retries() to service_role;

-- Cron janitor: reclaim stale PROCESSING leases (design §4.9, task 37).
create or replace function message_dispatcher.message_dispatcher_reclaim_leases()
returns integer
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_reclaimed integer;
begin
  with candidates as (
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'PROCESSING'
      and d.locked_until is not null
      and d.locked_until < now()
    order by d.locked_until, d.created_at
    limit 500
    for update of d skip locked
  )
  update message_dispatcher.message_dispatches d
  set
    status = case
      when d.retry_count >= d.max_retries then 'FAILED_TERMINAL'::message_dispatcher.message_dispatch_status
      else 'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status
    end,
    next_retry_at = case
      when d.retry_count < d.max_retries
        then message_dispatcher.message_dispatcher_compute_next_retry_at(d.retry_count)
      else null
    end,
    failure_code = coalesce(d.failure_code, 'lease_expired'),
    locked_until = null,
    locked_by = null,
    updated_at = now()
  from candidates c
  where d.id = c.id;

  get diagnostics v_reclaimed = row_count;
  return coalesce(v_reclaimed, 0);
end;
$$;

comment on function message_dispatcher.message_dispatcher_reclaim_leases() is
  'Cron RPC: stale PROCESSING → FAILED_RETRYABLE (with backoff) or FAILED_TERMINAL.';

revoke all on function message_dispatcher.message_dispatcher_reclaim_leases() from public;
revoke all on function message_dispatcher.message_dispatcher_reclaim_leases() from authenticated;
revoke all on function message_dispatcher.message_dispatcher_reclaim_leases() from anon;

grant execute on function message_dispatcher.message_dispatcher_reclaim_leases() to service_role;

-- Checkout DTO shape (design §5.3, task 49): correlation_id, channel targets, deliveries fan-out.
create or replace function message_dispatcher.message_dispatcher_build_checkout_dto(
  p_id uuid,
  p_profile_id uuid,
  p_channel message_dispatcher.message_channel,
  p_template_key text,
  p_template_variables jsonb,
  p_correlation_id uuid,
  p_status message_dispatcher.message_dispatch_status,
  p_locked_until timestamptz,
  p_locked_by text,
  p_recipient_email text,
  p_deliveries jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_id,
    'profile_id', p_profile_id,
    'channel', p_channel,
    'template_key', p_template_key,
    'template_variables', coalesce(p_template_variables, '{}'::jsonb),
    'correlation_id', p_correlation_id,
    'status', p_status,
    'locked_until', p_locked_until,
    'locked_by', p_locked_by,
    'recipient_email', p_recipient_email,
    'deliveries', coalesce(p_deliveries, '[]'::jsonb)
  );
$$;

revoke all on function message_dispatcher.message_dispatcher_build_checkout_dto(
  uuid,
  uuid,
  message_dispatcher.message_channel,
  text,
  jsonb,
  uuid,
  message_dispatcher.message_dispatch_status,
  timestamptz,
  text,
  text,
  jsonb
) from public;

revoke all on function message_dispatcher.message_dispatcher_build_checkout_dto(
  uuid,
  uuid,
  message_dispatcher.message_channel,
  text,
  jsonb,
  uuid,
  message_dispatcher.message_dispatch_status,
  timestamptz,
  text,
  text,
  jsonb
) from authenticated;

revoke all on function message_dispatcher.message_dispatcher_build_checkout_dto(
  uuid,
  uuid,
  message_dispatcher.message_channel,
  text,
  jsonb,
  uuid,
  message_dispatcher.message_dispatch_status,
  timestamptz,
  text,
  text,
  jsonb
) from anon;

comment on function message_dispatcher.message_dispatcher_build_checkout_dto(
  uuid,
  uuid,
  message_dispatcher.message_channel,
  text,
  jsonb,
  uuid,
  message_dispatcher.message_dispatch_status,
  timestamptz,
  text,
  text,
  jsonb
) is
  'Single checkout dispatch DTO for worker payload (design §5.3).';

-- Worker checkout: SKIP LOCKED claim QUEUED → PROCESSING (design §4.3, task 43). Lease fields: task 44.
create or replace function message_dispatcher.message_dispatcher_checkout_batch(
  p_limit integer default 25,
  p_worker_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_claimed record;
  v_dto_items jsonb[] := array[]::jsonb[];
  v_lease_seconds integer;
  v_recipient_email text;
  v_deliveries jsonb;
  v_max_devices integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'p_limit must be between 1 and 50'
      using errcode = '22023';
  end if;

  if nullif(trim(p_worker_id), '') is null then
    raise exception 'p_worker_id is required'
      using errcode = '22023';
  end if;

  select coalesce((pc.value #>> '{}')::integer, 30)
  into v_lease_seconds
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.lease_seconds';

  v_lease_seconds := coalesce(v_lease_seconds, 30);

  select coalesce((pc.value #>> '{}')::integer, 10)
  into v_max_devices
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.max_devices_per_dispatch';

  v_max_devices := coalesce(v_max_devices, 10);

  for v_claimed in
    with candidates as (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'QUEUED'
        and d.scheduled_for <= now()
      order by d.scheduled_for, d.created_at
      for update of d skip locked
      limit p_limit
    )
    update message_dispatcher.message_dispatches d
    set
      status = 'PROCESSING',
      locked_until = now() + make_interval(secs => v_lease_seconds),
      locked_by = p_worker_id,
      updated_at = now()
    from candidates c
    where d.id = c.id
    returning
      d.id,
      d.profile_id,
      d.channel,
      d.template_key,
      d.template_variables,
      d.correlation_id,
      d.status,
      d.locked_until,
      d.locked_by
  loop
    v_recipient_email := null;

    if v_claimed.channel = 'email' then
      select nullif(trim(u.email), '')
      into v_recipient_email
      from auth.users u
      where u.id = v_claimed.profile_id;

      if v_recipient_email is null then
        update message_dispatcher.message_dispatches d
        set
          status = 'FAILED_TERMINAL',
          failure_code = 'no_email_on_file',
          failure_reason = 'No email on file for profile',
          locked_until = null,
          locked_by = null,
          updated_at = now()
        where d.id = v_claimed.id;

        continue;
      end if;
    elsif v_claimed.channel = 'push' then
      with inserted as (
        insert into message_dispatcher.message_dispatch_deliveries (
          dispatch_id,
          device_id,
          fcm_token_snapshot
        )
        select
          v_claimed.id,
          b.device_id,
          b.fcm_token
        from public.user_device_beacons b
        where b.profile_id = v_claimed.profile_id
          and b.push_enabled = true
          and b.fcm_token is not null
          and trim(b.fcm_token) <> ''
        order by b.updated_at desc, b.device_id
        limit v_max_devices
        returning id, device_id, fcm_token_snapshot
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'delivery_id', inserted.id,
            'device_id', inserted.device_id,
            'fcm_token_snapshot', inserted.fcm_token_snapshot
          )
        ),
        '[]'::jsonb
      )
      into v_deliveries
      from inserted;

      if v_deliveries = '[]'::jsonb then
        update message_dispatcher.message_dispatches d
        set
          status = 'FAILED_TERMINAL',
          failure_code = 'no_push_targets',
          failure_reason = 'No eligible push devices for profile',
          locked_until = null,
          locked_by = null,
          updated_at = now()
        where d.id = v_claimed.id;

        continue;
      end if;

      v_dto_items := array_append(
        v_dto_items,
        message_dispatcher.message_dispatcher_build_checkout_dto(
          v_claimed.id,
          v_claimed.profile_id,
          v_claimed.channel,
          v_claimed.template_key,
          v_claimed.template_variables,
          v_claimed.correlation_id,
          v_claimed.status,
          v_claimed.locked_until,
          v_claimed.locked_by,
          null,
          v_deliveries
        )
      );

      continue;
    end if;

    v_deliveries := '[]'::jsonb;

    v_dto_items := array_append(
      v_dto_items,
      message_dispatcher.message_dispatcher_build_checkout_dto(
        v_claimed.id,
        v_claimed.profile_id,
        v_claimed.channel,
        v_claimed.template_key,
        v_claimed.template_variables,
        v_claimed.correlation_id,
        v_claimed.status,
        v_claimed.locked_until,
        v_claimed.locked_by,
        v_recipient_email,
        v_deliveries
      )
    );
  end loop;

  return coalesce(
    (
      select jsonb_agg(dto_item)
      from unnest(v_dto_items) as dto_item
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function message_dispatcher.message_dispatcher_checkout_batch(integer, text) is
  'Dequeue QUEUED → PROCESSING; returns jsonb_agg checkout DTO array (design §5.3, tasks 43–49).';

-- Checkout / report: service_role only (design §11.1, task 51).
revoke all on function message_dispatcher.message_dispatcher_checkout_batch(integer, text) from public;
revoke all on function message_dispatcher.message_dispatcher_checkout_batch(integer, text) from authenticated;
revoke all on function message_dispatcher.message_dispatcher_checkout_batch(integer, text) from anon;

grant execute on function message_dispatcher.message_dispatcher_checkout_batch(integer, text) to service_role;

-- FCM bad token hygiene (design §11.7, task 66).
create or replace function message_dispatcher.message_dispatcher_should_disable_beacon(
  p_error_code text
)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(nullif(trim(p_error_code), ''), '')) in (
    'invalid_token',
    'not_found',
    'unregistered',
    'registration-token-not-registered',
    'invalid_argument'
  )
    or lower(coalesce(nullif(trim(p_error_code), ''), '')) like '%invalid%token%';
$$;

create or replace function message_dispatcher.message_dispatcher_disable_device_beacon(
  p_profile_id uuid,
  p_device_id text
)
returns void
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
begin
  if p_profile_id is null or nullif(trim(p_device_id), '') is null then
    return;
  end if;

  update public.user_device_beacons b
  set
    push_enabled = false,
    fcm_token = null,
    updated_at = now()
  where b.profile_id = p_profile_id
    and b.device_id = trim(p_device_id);
end;
$$;

comment on function message_dispatcher.message_dispatcher_disable_device_beacon(uuid, text) is
  'Clears invalid FCM registration for a device (design §11.7).';

-- Report worker outcome (design §5.4, tasks 61–62). Success path: DELIVERED + delivery rows.
create or replace function message_dispatcher.message_dispatcher_report_delivery_outcome(
  p_dispatch_id uuid,
  p_worker_id text,
  p_channel message_dispatcher.message_channel,
  p_success boolean,
  p_vendor_message_id text default null,
  p_http_status integer default null,
  p_error_code text default null,
  p_error_body text default null,
  p_deliveries jsonb default '[]'::jsonb,
  p_retryable boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_dispatch message_dispatcher.message_dispatches%rowtype;
  v_delivery jsonb;
  v_outcome message_dispatcher.message_delivery_outcome;
  v_new_retry_count integer;
  v_metadata jsonb;
  v_partial_failures jsonb;
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'p_worker_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_dispatch
  from message_dispatcher.message_dispatches d
  where d.id = p_dispatch_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'dispatch_not_found');
  end if;

  if v_dispatch.status <> 'PROCESSING' then
    return jsonb_build_object(
      'applied', false,
      'reason', 'invalid_status',
      'status', v_dispatch.status
    );
  end if;

  if v_dispatch.locked_by is distinct from p_worker_id then
    return jsonb_build_object('applied', false, 'reason', 'lease_guard');
  end if;

  if v_dispatch.channel is distinct from p_channel then
    return jsonb_build_object('applied', false, 'reason', 'channel_mismatch');
  end if;

  v_metadata := coalesce(v_dispatch.metadata, '{}'::jsonb) || jsonb_build_object(
    'last_http_status', p_http_status,
    'last_error_code', p_error_code,
    'last_error_body', p_error_body
  );

  if not p_success then
    if v_dispatch.retry_count >= v_dispatch.max_retries then
      update message_dispatcher.message_dispatches d
      set
        status = 'FAILED_TERMINAL',
        failure_code = coalesce(nullif(trim(p_error_code), ''), 'max_retries_exhausted'),
        failure_reason = coalesce(
          nullif(trim(p_error_body), ''),
          format('max_retries exhausted (%s/%s)', v_dispatch.retry_count, v_dispatch.max_retries)
        ),
        locked_until = null,
        locked_by = null,
        metadata = v_metadata,
        updated_at = now()
      where d.id = p_dispatch_id;

      return jsonb_build_object(
        'applied', true,
        'status', 'FAILED_TERMINAL',
        'dispatch_id', p_dispatch_id,
        'reason', 'max_retries_exhausted'
      );
    end if;

    if coalesce(p_retryable, false) then
      v_new_retry_count := v_dispatch.retry_count + 1;

      update message_dispatcher.message_dispatches d
      set
        status = 'FAILED_RETRYABLE',
        retry_count = v_new_retry_count,
        next_retry_at = message_dispatcher.message_dispatcher_compute_next_retry_at(
          v_new_retry_count
        ),
        failure_code = coalesce(nullif(trim(p_error_code), ''), 'provider_retryable'),
        failure_reason = nullif(trim(p_error_body), ''),
        locked_until = null,
        locked_by = null,
        metadata = v_metadata,
        updated_at = now()
      where d.id = p_dispatch_id;

      if p_channel = 'push'::message_dispatcher.message_channel then
        for v_delivery in
          select value
          from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
        loop
          v_outcome := coalesce(
            (v_delivery->>'outcome')::message_dispatcher.message_delivery_outcome,
            'failed_retryable'::message_dispatcher.message_delivery_outcome
          );

          update message_dispatcher.message_dispatch_deliveries del
          set
            outcome = v_outcome,
            vendor_error_code = v_delivery->>'vendor_error_code',
            updated_at = now()
          where del.id = (v_delivery->>'delivery_id')::uuid
            and del.dispatch_id = p_dispatch_id;
        end loop;
      end if;

      return jsonb_build_object(
        'applied', true,
        'status', 'FAILED_RETRYABLE',
        'dispatch_id', p_dispatch_id,
        'retry_count', v_new_retry_count,
        'next_retry_at',
        (
          select d.next_retry_at
          from message_dispatcher.message_dispatches d
          where d.id = p_dispatch_id
        )
      );
    end if;

    update message_dispatcher.message_dispatches d
    set
      status = 'FAILED_TERMINAL',
      failure_code = coalesce(nullif(trim(p_error_code), ''), 'provider_terminal'),
      failure_reason = nullif(trim(p_error_body), ''),
      locked_until = null,
      locked_by = null,
      metadata = v_metadata,
      updated_at = now()
    where d.id = p_dispatch_id;

    if p_channel = 'push'::message_dispatcher.message_channel then
      for v_delivery in
        select value
        from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
      loop
        v_outcome := coalesce(
          (v_delivery->>'outcome')::message_dispatcher.message_delivery_outcome,
          'failed_terminal'::message_dispatcher.message_delivery_outcome
        );

        update message_dispatcher.message_dispatch_deliveries del
        set
          outcome = v_outcome,
          vendor_error_code = v_delivery->>'vendor_error_code',
          updated_at = now()
        where del.id = (v_delivery->>'delivery_id')::uuid
          and del.dispatch_id = p_dispatch_id;

        if message_dispatcher.message_dispatcher_should_disable_beacon(
          coalesce(v_delivery->>'vendor_error_code', p_error_code)
        )
        and nullif(v_delivery->>'device_id', '') is not null then
          perform message_dispatcher.message_dispatcher_disable_device_beacon(
            v_dispatch.profile_id,
            v_delivery->>'device_id'
          );
        end if;
      end loop;
    end if;

    return jsonb_build_object(
      'applied', true,
      'status', 'FAILED_TERMINAL',
      'dispatch_id', p_dispatch_id
    );
  end if;

  if p_channel = 'push'::message_dispatcher.message_channel then
    v_partial_failures := coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'delivery_id', elem->>'delivery_id',
            'device_id', elem->>'device_id',
            'outcome', elem->>'outcome',
            'vendor_error_code', elem->>'vendor_error_code'
          )
        )
        from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb)) elem
        where coalesce(elem->>'outcome', 'sent') is distinct from 'sent'
      ),
      '[]'::jsonb
    );

    if jsonb_array_length(v_partial_failures) > 0 then
      v_metadata := v_metadata || jsonb_build_object('partial_failures', v_partial_failures);
    end if;
  end if;

  update message_dispatcher.message_dispatches d
  set
    status = 'DELIVERED',
    vendor_message_id = p_vendor_message_id,
    locked_until = null,
    locked_by = null,
    metadata = v_metadata,
    updated_at = now()
  where d.id = p_dispatch_id;

  if p_channel = 'push'::message_dispatcher.message_channel then
    for v_delivery in
      select value
      from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
    loop
      v_outcome := coalesce(
        (v_delivery->>'outcome')::message_dispatcher.message_delivery_outcome,
        'sent'::message_dispatcher.message_delivery_outcome
      );

      update message_dispatcher.message_dispatch_deliveries del
      set
        outcome = v_outcome,
        vendor_error_code = v_delivery->>'vendor_error_code',
        updated_at = now()
      where del.id = (v_delivery->>'delivery_id')::uuid
        and del.dispatch_id = p_dispatch_id;

      if v_outcome = 'failed_terminal'::message_dispatcher.message_delivery_outcome
        and message_dispatcher.message_dispatcher_should_disable_beacon(
          v_delivery->>'vendor_error_code'
        )
        and nullif(v_delivery->>'device_id', '') is not null then
        perform message_dispatcher.message_dispatcher_disable_device_beacon(
          v_dispatch.profile_id,
          v_delivery->>'device_id'
        );
      end if;
    end loop;

  end if;

  if p_channel in (
    'email'::message_dispatcher.message_channel,
    'push'::message_dispatcher.message_channel
  ) then
    insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
    values (v_dispatch.profile_id)
    on conflict (profile_id) do nothing;

    update message_dispatcher.message_dispatcher_user_limits ul
    set
      last_push_sent_at = case
        when p_channel = 'push'::message_dispatcher.message_channel then now()
        else ul.last_push_sent_at
      end,
      push_count_24h = case
        when p_channel = 'push'::message_dispatcher.message_channel then
          case
            when now() - ul.push_window_start > interval '24 hours' then 1
            else ul.push_count_24h + 1
          end
        else ul.push_count_24h
      end,
      push_window_start = case
        when p_channel = 'push'::message_dispatcher.message_channel then
          case
            when now() - ul.push_window_start > interval '24 hours' then now()
            else ul.push_window_start
          end
        else ul.push_window_start
      end,
      email_count_24h = case
        when p_channel = 'email'::message_dispatcher.message_channel then
          case
            when now() - ul.email_window_start > interval '24 hours' then 1
            else ul.email_count_24h + 1
          end
        else ul.email_count_24h
      end,
      email_window_start = case
        when p_channel = 'email'::message_dispatcher.message_channel then
          case
            when now() - ul.email_window_start > interval '24 hours' then now()
            else ul.email_window_start
          end
        else ul.email_window_start
      end
    where ul.profile_id = v_dispatch.profile_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'status', 'DELIVERED',
    'dispatch_id', p_dispatch_id
  );
end;
$$;

comment on function message_dispatcher.message_dispatcher_report_delivery_outcome(
  uuid,
  text,
  message_dispatcher.message_channel,
  boolean,
  text,
  integer,
  text,
  text,
  jsonb,
  boolean
) is
  'Worker completion RPC: DELIVERED / FAILED_RETRYABLE / FAILED_TERMINAL (design §5.4, tasks 61–67).';

revoke all on function message_dispatcher.message_dispatcher_report_delivery_outcome(
  uuid,
  text,
  message_dispatcher.message_channel,
  boolean,
  text,
  integer,
  text,
  text,
  jsonb,
  boolean
) from public;

revoke all on function message_dispatcher.message_dispatcher_report_delivery_outcome(
  uuid,
  text,
  message_dispatcher.message_channel,
  boolean,
  text,
  integer,
  text,
  text,
  jsonb,
  boolean
) from authenticated;

revoke all on function message_dispatcher.message_dispatcher_report_delivery_outcome(
  uuid,
  text,
  message_dispatcher.message_channel,
  boolean,
  text,
  integer,
  text,
  text,
  jsonb,
  boolean
) from anon;

grant execute on function message_dispatcher.message_dispatcher_report_delivery_outcome(
  uuid,
  text,
  message_dispatcher.message_channel,
  boolean,
  text,
  integer,
  text,
  text,
  jsonb,
  boolean
) to service_role;

-- Resend webhook event classification (design §4.5, task 74).
create or replace function message_dispatcher.message_dispatcher_is_resend_delivered_event(
  p_event_type text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select lower(trim(coalesce(p_event_type, ''))) = 'email.delivered';
$$;

create or replace function message_dispatcher.message_dispatcher_is_resend_hard_bounce_event(
  p_event_type text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select lower(trim(coalesce(p_event_type, ''))) = 'email.bounced';
$$;

-- Webhook reconcile ingress (design §4.5, §5.6, task 74, Req.6 AC2).
create or replace function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  p_vendor_event_id text,
  p_vendor text,
  p_event_type text,
  p_vendor_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_vendor_event_id text;
  v_dispatch message_dispatcher.message_dispatches%rowtype;
begin
  if nullif(trim(p_vendor_event_id), '') is null then
    raise exception 'p_vendor_event_id is required'
      using errcode = '22023';
  end if;

  if nullif(trim(p_vendor), '') is null then
    raise exception 'p_vendor is required'
      using errcode = '22023';
  end if;

  insert into message_dispatcher.message_dispatcher_vendor_events (
    vendor_event_id,
    dispatch_id,
    vendor,
    event_type,
    payload
  )
  values (
    trim(p_vendor_event_id),
    null,
    trim(p_vendor),
    coalesce(nullif(trim(p_event_type), ''), 'unknown'),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (vendor_event_id) do nothing
  returning vendor_event_id into v_vendor_event_id;

  if v_vendor_event_id is null then
    -- At-least-once webhook replay: success noop, no dispatch mutation (design §4.5, task 75).
    return jsonb_build_object(
      'applied', true,
      'duplicate', true,
      'dispatch_updated', false,
      'vendor_event_id', trim(p_vendor_event_id)
    );
  end if;

  if nullif(trim(p_vendor_message_id), '') is null then
    return jsonb_build_object(
      'applied', true,
      'dispatch_updated', false,
      'reason', 'missing_vendor_message_id',
      'vendor_event_id', v_vendor_event_id
    );
  end if;

  select *
  into v_dispatch
  from message_dispatcher.message_dispatches d
  where d.vendor_message_id = trim(p_vendor_message_id)
  for update;

  if not found then
    return jsonb_build_object(
      'applied', true,
      'dispatch_updated', false,
      'reason', 'dispatch_not_found',
      'vendor_event_id', v_vendor_event_id
    );
  end if;

  update message_dispatcher.message_dispatcher_vendor_events ve
  set dispatch_id = v_dispatch.id
  where ve.vendor_event_id = v_vendor_event_id;

  if message_dispatcher.message_dispatcher_is_resend_delivered_event(p_event_type) then
    -- Idempotent delivered path: worker may have set DELIVERED first (design §4.5, task 76).
    if v_dispatch.status = 'DELIVERED'::message_dispatcher.message_dispatch_status then
      return jsonb_build_object(
        'applied', true,
        'dispatch_updated', false,
        'status', 'DELIVERED',
        'noop', true,
        'dispatch_id', v_dispatch.id
      );
    end if;

    if v_dispatch.status = 'PROCESSING'::message_dispatcher.message_dispatch_status then
      update message_dispatcher.message_dispatches d
      set
        status = 'DELIVERED',
        locked_until = null,
        locked_by = null,
        updated_at = now()
      where d.id = v_dispatch.id;

      return jsonb_build_object(
        'applied', true,
        'dispatch_updated', true,
        'status', 'DELIVERED',
        'dispatch_id', v_dispatch.id
      );
    end if;

    return jsonb_build_object(
      'applied', true,
      'dispatch_updated', false,
      'reason', 'invalid_status_for_delivered',
      'status', v_dispatch.status,
      'dispatch_id', v_dispatch.id
    );
  end if;

  if message_dispatcher.message_dispatcher_is_resend_hard_bounce_event(p_event_type) then
    -- Hard bounce → terminal dead-letter, no requeue (design §8.3, task 77).
    if v_dispatch.status in (
      'DELIVERED'::message_dispatcher.message_dispatch_status,
      'CANCELED'::message_dispatcher.message_dispatch_status,
      'FAILED_TERMINAL'::message_dispatcher.message_dispatch_status
    ) then
      return jsonb_build_object(
        'applied', true,
        'dispatch_updated', false,
        'reason', 'terminal_status_unchanged',
        'status', v_dispatch.status,
        'dispatch_id', v_dispatch.id
      );
    end if;

    update message_dispatcher.message_dispatches d
    set
      status = 'FAILED_TERMINAL',
      failure_code = 'hard_bounce',
      failure_reason = coalesce(
        p_payload->>'bounce_type',
        p_payload->>'type',
        'resend_hard_bounce'
      ),
      locked_until = null,
      locked_by = null,
      updated_at = now()
    where d.id = v_dispatch.id;

    return jsonb_build_object(
      'applied', true,
      'dispatch_updated', true,
      'status', 'FAILED_TERMINAL',
      'failure_code', 'hard_bounce',
      'dispatch_id', v_dispatch.id
    );
  end if;

  return jsonb_build_object(
    'applied', true,
    'dispatch_updated', false,
    'reason', 'unhandled_event_type',
    'event_type', p_event_type,
    'dispatch_id', v_dispatch.id
  );
end;
$$;

comment on function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  text,
  text,
  text,
  text,
  jsonb
) is
  'Resend/FCM webhook reconcile: dedupe vendor_event_id, match vendor_message_id (design §4.5, task 74).';

revoke all on function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  text,
  text,
  text,
  text,
  jsonb
) from public;

revoke all on function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  text,
  text,
  text,
  text,
  jsonb
) from authenticated;

revoke all on function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  text,
  text,
  text,
  text,
  jsonb
) from anon;

grant execute on function message_dispatcher.message_dispatcher_reconcile_vendor_event(
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

-- Support audit timeline (design §10.4, task 80, Req.6 AC3).
create or replace function message_dispatcher.message_dispatcher_audit_timeline(
  p_dispatch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_profile_id uuid;
  v_timeline jsonb;
begin
  if p_dispatch_id is null then
    raise exception 'p_dispatch_id is required'
      using errcode = '22023';
  end if;

  select d.profile_id
  into v_profile_id
  from message_dispatcher.message_dispatches d
  where d.id = p_dispatch_id;

  if not found then
    return '[]'::jsonb;
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and (select auth.uid()) is distinct from v_profile_id
  then
    raise exception 'not authorized to read audit timeline'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'dispatch_id', a.dispatch_id,
        'profile_id', a.profile_id,
        'old_status', a.old_status,
        'new_status', a.new_status,
        'changed_by', a.changed_by,
        'correlation_id', a.correlation_id,
        'delta', a.delta,
        'created_at', a.created_at
      )
      order by a.created_at asc
    ),
    '[]'::jsonb
  )
  into v_timeline
  from message_dispatcher.message_dispatcher_audit a
  where a.dispatch_id = p_dispatch_id;

  return v_timeline;
end;
$$;

comment on function message_dispatcher.message_dispatcher_audit_timeline(uuid) is
  'Ordered audit rows for a dispatch (design §10.4). Caller: service_role or dispatch owner.';

revoke all on function message_dispatcher.message_dispatcher_audit_timeline(uuid) from public;
revoke all on function message_dispatcher.message_dispatcher_audit_timeline(uuid) from anon;

grant execute on function message_dispatcher.message_dispatcher_audit_timeline(uuid) to authenticated;
grant execute on function message_dispatcher.message_dispatcher_audit_timeline(uuid) to service_role;
