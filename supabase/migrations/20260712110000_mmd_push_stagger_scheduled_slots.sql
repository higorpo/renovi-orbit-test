-- MMD: stagger push scheduled_for across pending queue (ingest + evaluate_pending).

create or replace function message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
  p_profile_id uuid,
  p_last_push_sent_at timestamptz,
  p_cooldown_minutes integer,
  p_sibling_offset integer default 0,
  p_exclude_dispatch_id uuid default null
)
returns timestamptz
language sql
stable
security definer
set search_path = message_dispatcher, public, auth
as $$
  select greatest(
    now(),
    case
      when p_last_push_sent_at is not null then
        p_last_push_sent_at + make_interval(mins => coalesce(p_cooldown_minutes, 10))
      else '-infinity'::timestamptz
    end,
    coalesce(
      (
        select max(d.scheduled_for) + make_interval(mins => coalesce(p_cooldown_minutes, 10))
        from message_dispatcher.message_dispatches d
        where d.profile_id = p_profile_id
          and d.channel = 'push'::message_dispatcher.message_channel
          and d.status in (
            'SCHEDULED'::message_dispatcher.message_dispatch_status,
            'QUEUED'::message_dispatcher.message_dispatch_status,
            'PROCESSING'::message_dispatcher.message_dispatch_status
          )
          and coalesce(d.bypass_limits, false) = false
          and (p_exclude_dispatch_id is null or d.id <> p_exclude_dispatch_id)
      ),
      '-infinity'::timestamptz
    )
  )
  + (greatest(coalesce(p_sibling_offset, 0), 0) * make_interval(mins => coalesce(p_cooldown_minutes, 10)));
$$;

comment on function message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
  uuid, timestamptz, integer, integer, uuid
) is
  'Next push send slot: max(now(), last delivered + cooldown, tail of pending queue) + sibling offset * cooldown.';

revoke all on function message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
  uuid, timestamptz, integer, integer, uuid
) from public, anon, authenticated;
grant execute on function message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
  uuid, timestamptz, integer, integer, uuid
) to service_role;

create or replace function message_dispatcher.message_dispatcher_ingest(
  p_idempotency_key uuid,
  p_profile_id uuid,
  p_channel message_dispatcher.message_channel,
  p_template_key text,
  p_template_variables jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now(),
  p_source_system text default 'orbit',
  p_metadata jsonb default '{}'::jsonb,
  p_bypass_limits boolean default false
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
  v_dispatch_id uuid;
  v_dispatch_status message_dispatcher.message_dispatch_status;
  v_dispatch_scheduled timestamptz;
  v_rate_limit_meta jsonb;
  v_dispatch_metadata jsonb;
  v_quiet_rescheduled boolean := false;
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

  if p_channel = 'email' and not coalesce(p_bypass_limits, false) then
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
      and d.created_at > now() - interval '24 hours'
      and coalesce(d.bypass_limits, false) = false;

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
        bypass_limits,
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
        coalesce(p_bypass_limits, false),
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

  if p_channel = 'push' and not coalesce(p_bypass_limits, false) then
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
      and d.created_at > now() - interval '24 hours'
      and coalesce(d.bypass_limits, false) = false;

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
        bypass_limits,
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
        coalesce(p_bypass_limits, false),
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

    select coalesce((pc.value #>> '{}')::integer, 10)
    into v_push_cooldown_minutes
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.push_cooldown_minutes';

    v_push_cooldown_minutes := coalesce(v_push_cooldown_minutes, 10);

    v_dispatch_scheduled := message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
      p_profile_id,
      v_limits.last_push_sent_at,
      v_push_cooldown_minutes,
      0,
      null
    );

    if message_dispatcher.message_dispatcher_is_quiet_hours(v_dispatch_scheduled) then
      v_dispatch_scheduled := message_dispatcher.message_dispatcher_next_send_window(v_dispatch_scheduled);
      v_quiet_rescheduled := true;
    end if;

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
      metadata,
      bypass_limits
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
      coalesce(p_metadata, '{}'::jsonb),
      coalesce(p_bypass_limits, false) or v_quiet_rescheduled
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

  v_dispatch_scheduled := coalesce(p_scheduled_for, now());

  if v_dispatch_scheduled > now() then
    v_dispatch_status := 'SCHEDULED';
  else
    v_dispatch_status := 'QUEUED';
  end if;

  if message_dispatcher.message_dispatcher_is_quiet_hours(v_dispatch_scheduled) then
    v_dispatch_scheduled := message_dispatcher.message_dispatcher_next_send_window(v_dispatch_scheduled);
    v_dispatch_status := 'SCHEDULED';
    v_quiet_rescheduled := true;
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
    metadata,
    bypass_limits
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
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_bypass_limits, false) or v_quiet_rescheduled
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
  uuid, uuid, message_dispatcher.message_channel, text, jsonb, timestamptz, text, jsonb, boolean
) is
  'Ingest dispatch; push rate limits use staggered scheduled_for via compute_push_scheduled_slot.';

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
  v_quiet_hours integer := 0;
  v_push_queued integer := 0;
  v_push_staggered integer := 0;
begin
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

  select coalesce((pc.value #>> '{}')::integer, 10)
  into v_push_cooldown_minutes
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.push_cooldown_minutes';
  v_push_cooldown_minutes := coalesce(v_push_cooldown_minutes, 10);

  insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
  select distinct d.profile_id
  from message_dispatcher.message_dispatches d
  where d.status = 'PENDING_EVALUATION'
  on conflict (profile_id) do nothing;

  with pending_email as (
    select d.id, d.profile_id, d.created_at
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'email'
      and d.bypass_limits = false
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
          and coalesce(dx.bypass_limits, false) = false
          and dx.id <> pe.id
      ) + (
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

  with pending_push as (
    select d.id, d.profile_id, d.created_at
    from message_dispatcher.message_dispatches d
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'push'
      and d.bypass_limits = false
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
          and coalesce(dx.bypass_limits, false) = false
          and dx.id <> pp.id
      ) + (
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

  with pending_push_cooldown_locked as (
    select d.id
    from message_dispatcher.message_dispatches d
    join message_dispatcher.message_dispatcher_user_limits ul
      on ul.profile_id = d.profile_id
    where d.status = 'PENDING_EVALUATION'
      and d.channel = 'push'
      and d.bypass_limits = false
      and ul.last_push_sent_at is not null
      and now() < ul.last_push_sent_at + make_interval(mins => v_push_cooldown_minutes)
    order by d.created_at
    limit 500
    for update of d skip locked
  ),
  pending_push_cooldown as (
    select
      d.id,
      d.profile_id,
      ul.last_push_sent_at,
      row_number() over (
        partition by d.profile_id
        order by d.created_at, d.id
      ) - 1 as sibling_offset
    from pending_push_cooldown_locked ppl
    join message_dispatcher.message_dispatches d on d.id = ppl.id
    join message_dispatcher.message_dispatcher_user_limits ul
      on ul.profile_id = d.profile_id
  ),
  slots as (
    select
      ppc.id,
      message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
        ppc.profile_id,
        ppc.last_push_sent_at,
        v_push_cooldown_minutes,
        ppc.sibling_offset::integer,
        ppc.id
      ) as slot_at
    from pending_push_cooldown ppc
  ),
  rescheduled as (
    update message_dispatcher.message_dispatches d
    set
      status = 'SCHEDULED',
      scheduled_for = case
        when message_dispatcher.message_dispatcher_is_quiet_hours(s.slot_at)
        then message_dispatcher.message_dispatcher_next_send_window(s.slot_at)
        else s.slot_at
      end,
      bypass_limits = case
        when message_dispatcher.message_dispatcher_is_quiet_hours(s.slot_at)
        then true
        else d.bypass_limits
      end,
      updated_at = now()
    from slots s
    where d.id = s.id
    returning d.id
  )
  select count(*) into v_cooldown_push from rescheduled;

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

  if message_dispatcher.message_dispatcher_is_quiet_hours(now()) then
    with quiet_hours_remaining as (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'PENDING_EVALUATION'
      order by d.created_at
      limit 500
      for update of d skip locked
    ),
    rescheduled_quiet as (
      update message_dispatcher.message_dispatches d
      set
        status = 'SCHEDULED',
        scheduled_for = message_dispatcher.message_dispatcher_next_send_window(now()),
        bypass_limits = true,
        updated_at = now()
      from quiet_hours_remaining qhr
      where d.id = qhr.id
      returning d.id
    )
    select count(*) into v_quiet_hours from rescheduled_quiet;
  else
    with pending_push_release_locked as (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'PENDING_EVALUATION'
        and d.channel = 'push'
        and d.bypass_limits = false
      order by d.created_at
      limit 500
      for update of d skip locked
    ),
    pending_push_release as (
      select
        d.id,
        d.profile_id,
        d.created_at,
        ul.last_push_sent_at,
        row_number() over (
          partition by d.profile_id
          order by d.created_at, d.id
        ) - 1 as sibling_offset
      from pending_push_release_locked pprl
      join message_dispatcher.message_dispatches d on d.id = pprl.id
      join message_dispatcher.message_dispatcher_user_limits ul
        on ul.profile_id = d.profile_id
    ),
    push_slots as (
      select
        ppr.id,
        ppr.sibling_offset,
        message_dispatcher.message_dispatcher_compute_push_scheduled_slot(
          ppr.profile_id,
          ppr.last_push_sent_at,
          v_push_cooldown_minutes,
          ppr.sibling_offset::integer,
          ppr.id
        ) as slot_at
      from pending_push_release ppr
    ),
    push_to_queue as (
      select ps.id
      from push_slots ps
      where ps.sibling_offset = 0
        and ps.slot_at <= now()
    ),
    push_queued_rows as (
      update message_dispatcher.message_dispatches d
      set
        status = 'QUEUED',
        scheduled_for = ps.slot_at,
        updated_at = now()
      from push_slots ps
      inner join push_to_queue pq on pq.id = ps.id
      where d.id = ps.id
      returning d.id
    ),
    push_staggered_rows as (
      update message_dispatcher.message_dispatches d
      set
        status = 'SCHEDULED',
        scheduled_for = case
          when message_dispatcher.message_dispatcher_is_quiet_hours(ps.slot_at)
          then message_dispatcher.message_dispatcher_next_send_window(ps.slot_at)
          else ps.slot_at
        end,
        bypass_limits = case
          when message_dispatcher.message_dispatcher_is_quiet_hours(ps.slot_at)
          then true
          else d.bypass_limits
        end,
        updated_at = now()
      from push_slots ps
      where d.id = ps.id
        and d.status = 'PENDING_EVALUATION'
        and not exists (select 1 from push_to_queue pq where pq.id = ps.id)
      returning d.id
    ),
    remaining as (
      select d.id
      from message_dispatcher.message_dispatches d
      where d.status = 'PENDING_EVALUATION'
        and (d.channel <> 'push' or d.bypass_limits = true)
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
    select
      (select count(*) from push_queued_rows),
      (select count(*) from push_staggered_rows),
      (select count(*) from moved_to_queued)
    into v_push_queued, v_push_staggered, v_queued;
  end if;

  v_evaluated := v_terminal_email + v_terminal_push + v_cooldown_push + v_scheduled
    + v_quiet_hours + v_push_queued + v_push_staggered + v_queued;
  return v_evaluated;
end;
$$;

comment on function message_dispatcher.message_dispatcher_evaluate_pending() is
  'Cron subroutine: PENDING_EVALUATION → QUEUED, SCHEDULED, or terminal; push uses staggered slots.';
