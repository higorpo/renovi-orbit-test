-- Far post-PAID reschedule: prepare/commit RPCs, claim batch, cron safety-net, wake on reschedule.

-- ---------------------------------------------------------------------------
-- payment_reschedule_charge_date: add pg_net wake (depends on orbit_invoke)
-- ---------------------------------------------------------------------------

create or replace function public.payment_reschedule_charge_date(
  p_contracted_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_exec_at timestamptz;
  v_new_charge_at timestamptz;
  v_old_charge_at timestamptz;
  v_threshold_days int;
  v_far boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_reschedule_charge_date'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select *
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
    and not public.payment_schedule_state_is_terminal(ps.state)
  for update;

  if not found then
    return jsonb_build_object('outcome', 'no_schedule');
  end if;

  if v_schedule.state = 'PAID' then
    v_exec_at := public.payment_service_execution_at(v_cs);
    v_threshold_days := public.platform_constant_int(
      'far_reschedule_recapture_threshold_days',
      15
    );
    v_far := v_exec_at > (now() + make_interval(days => v_threshold_days));

    if v_far then
      if v_schedule.far_recapture_pending_at is null then
        update public.payment_schedules ps
        set
          far_recapture_pending_at = now(),
          updated_at = now()
        where ps.id = v_schedule.id;

        perform public.payment_write_audit(
          p_event_type := 'FAR_RESCHEDULE_RECAPTURE_PENDING',
          p_entity_type := 'payment_schedule',
          p_entity_id := v_schedule.id,
          p_service_id := p_contracted_service_id,
          p_schedule_id := v_schedule.id,
          p_actor := 'system',
          p_metadata := jsonb_build_object(
            'execution_at', v_exec_at,
            'threshold_days', v_threshold_days
          )
        );
      end if;

      if public.orbit_internal_edge_invoke_is_configured() then
        begin
          perform public.orbit_invoke_edge_function(
            'process-far-reschedule-recapture',
            jsonb_build_object(
              'schedule_id', v_schedule.id,
              'contracted_service_id', p_contracted_service_id
            ),
            55000
          );
        exception
          when others then
            raise warning
              'payment_reschedule_charge_date wake process-far-reschedule-recapture failed: %',
              sqlerrm;
        end;
      end if;

      return jsonb_build_object(
        'outcome', 'paid_far_recapture_required',
        'schedule_id', v_schedule.id,
        'execution_at', v_exec_at,
        'threshold_days', v_threshold_days
      );
    end if;

    return jsonb_build_object(
      'outcome', 'paid_no_charge_update',
      'schedule_id', v_schedule.id
    );
  end if;

  if v_schedule.state not in ('SCHEDULED', 'FAILED', 'IN_ANALYSIS') then
    return jsonb_build_object(
      'outcome', 'ineligible_state',
      'schedule_id', v_schedule.id,
      'state', v_schedule.state
    );
  end if;

  v_exec_at := public.payment_service_execution_at(v_cs);
  v_old_charge_at := v_schedule.charge_scheduled_at;
  v_new_charge_at := public.payment_compute_charge_scheduled_at(v_cs);

  update public.payment_schedules ps
  set
    charge_scheduled_at = v_new_charge_at,
    upcoming_charge_notified_at = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_RESCHEDULED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'old_charge_scheduled_at', v_old_charge_at,
      'new_charge_scheduled_at', v_new_charge_at,
      'emergency_scheduling', v_new_charge_at <= now()
    )
  );

  return jsonb_build_object(
    'outcome', 'rescheduled',
    'schedule_id', v_schedule.id,
    'old_charge_scheduled_at', v_old_charge_at,
    'new_charge_scheduled_at', v_new_charge_at
  );
end;
$$;

comment on function public.payment_reschedule_charge_date(uuid) is
  'Recomputes charge_scheduled_at after slot reschedule; post-PAID near keeps money; far marks pending + wakes process-far-reschedule-recapture (service_role).';

-- ---------------------------------------------------------------------------
-- Prepare: validate PAID + pending; full refund amount; no cancel
-- ---------------------------------------------------------------------------

create or replace function public.payment_prepare_far_reschedule_recapture(
  p_schedule_id uuid default null,
  p_contracted_service_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_charge_amount numeric(12, 2);
  v_new_schedule_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_prepare_far_reschedule_recapture'
      using errcode = '42501';
  end if;

  if p_schedule_id is null and p_contracted_service_id is null then
    raise exception 'p_schedule_id or p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_schedule_id is not null then
    select *
    into v_schedule
    from public.payment_schedules ps
    where ps.id = p_schedule_id
    for update;
  else
    select *
    into v_schedule
    from public.payment_schedules ps
    where ps.contracted_service_id = p_contracted_service_id
      and ps.state = 'PAID'::public.payment_schedule_state
      and ps.far_recapture_pending_at is not null
    for update;
  end if;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- Idempotent: already recaptured
  select newer.id
  into v_new_schedule_id
  from public.payment_schedules newer
  where newer.supersedes_schedule_id = v_schedule.id
  limit 1;

  if v_schedule.state in (
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state
  ) and v_new_schedule_id is not null then
    return jsonb_build_object(
      'outcome', 'already_done',
      'schedule_id', v_schedule.id,
      'new_schedule_id', v_new_schedule_id,
      'contracted_service_id', v_schedule.contracted_service_id
    );
  end if;

  if v_schedule.state <> 'PAID'::public.payment_schedule_state then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.far_recapture_pending_at is null then
    raise exception 'FAR_RECAPTURE_NOT_PENDING'
      using errcode = 'P0001';
  end if;

  if v_schedule.gateway_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  select *
  into v_service
  from public.contracted_services cs
  where cs.id = v_schedule.contracted_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_service.status <> 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_SERVICE_STATUS'
      using errcode = 'P0001';
  end if;

  v_charge_amount := coalesce(
    v_schedule.paid_amount,
    public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );

  return jsonb_build_object(
    'outcome', 'ready',
    'schedule_id', v_schedule.id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'gateway_transaction_id', v_schedule.gateway_transaction_id,
    'gateway_reference_code', v_schedule.gateway_reference_code,
    'paid_amount', v_schedule.paid_amount,
    'base_amount', v_schedule.base_amount,
    'charge_amount', v_charge_amount,
    'refund_amount', v_charge_amount,
    'penalty_tier', null,
    'reason', 'FAR_RESCHEDULE_RECAPTURE',
    'already_submitted', v_schedule.refund_submit_status in (
      'SUBMITTED'::public.payment_refund_submit_status,
      'CONFIRMED'::public.payment_refund_submit_status
    ),
    'refund_submit_status', v_schedule.refund_submit_status
  );
end;
$$;

comment on function public.payment_prepare_far_reschedule_recapture(uuid, uuid) is
  'Validates PAID far-recapture pending and returns full refund amount; does not cancel service/chat. service_role only.';

revoke all on function public.payment_prepare_far_reschedule_recapture(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.payment_prepare_far_reschedule_recapture(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Commit after gateway ACK: old REFUNDED + new SCHEDULED + PENDING_PAYMENT
-- ---------------------------------------------------------------------------

create or replace function public.payment_commit_far_reschedule_after_gateway(
  p_schedule_id uuid,
  p_expected_refund_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_charge_amount numeric(12, 2);
  v_refund_amount numeric(12, 2);
  v_new_id uuid;
  v_cycle int;
  v_idempotency text;
  v_new_charge_at timestamptz;
  v_existing_new uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_commit_far_reschedule_after_gateway'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select newer.id
  into v_existing_new
  from public.payment_schedules newer
  where newer.supersedes_schedule_id = v_schedule.id
  limit 1;

  if v_schedule.state in (
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state
  ) and v_existing_new is not null then
    return jsonb_build_object(
      'outcome', 'already_done',
      'schedule_id', v_schedule.id,
      'new_schedule_id', v_existing_new,
      'contracted_service_id', v_schedule.contracted_service_id
    );
  end if;

  if v_schedule.state <> 'PAID'::public.payment_schedule_state then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.far_recapture_pending_at is null then
    raise exception 'FAR_RECAPTURE_NOT_PENDING'
      using errcode = 'P0001';
  end if;

  select *
  into v_service
  from public.contracted_services cs
  where cs.id = v_schedule.contracted_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_service.status <> 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_SERVICE_STATUS'
      using errcode = 'P0001';
  end if;

  v_charge_amount := coalesce(
    v_schedule.paid_amount,
    public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );
  v_refund_amount := v_charge_amount;

  if p_expected_refund_amount is not null then
    if abs(p_expected_refund_amount - v_refund_amount) > 0.01 then
      raise exception 'INVALID_REFUND_AMOUNT'
        using errcode = 'P0001';
    end if;
    v_refund_amount := round(p_expected_refund_amount::numeric, 2);
  end if;

  update public.payment_schedules ps
  set
    state = 'REFUNDED'::public.payment_schedule_state,
    refunded_at = coalesce(ps.refunded_at, now()),
    refunded_amount = v_refund_amount,
    refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status,
    cancellation_reason = 'FAR_RESCHEDULE_RECAPTURE',
    far_recapture_pending_at = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  select count(*)::int + 1
  into v_cycle
  from public.payment_schedules ps
  where ps.contracted_service_id = v_schedule.contracted_service_id;

  v_idempotency := v_schedule.contracted_service_id::text || ':c' || v_cycle::text;
  v_new_charge_at := public.payment_compute_charge_scheduled_at(v_service);
  v_new_id := gen_random_uuid();

  insert into public.payment_schedules (
    id,
    contracted_service_id,
    client_id,
    provider_id,
    gateway_slug,
    client_card_token_id,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    automatic_attempt_count,
    manual_attempt_count,
    max_attempts,
    idempotency_key,
    clearsale_session_id,
    client_ip_address,
    gateway_reference_code,
    supersedes_schedule_id
  ) values (
    v_new_id,
    v_schedule.contracted_service_id,
    v_schedule.client_id,
    v_schedule.provider_id,
    v_schedule.gateway_slug,
    v_schedule.client_card_token_id,
    v_schedule.installment_number,
    v_schedule.base_amount,
    v_schedule.commission_rate_pct,
    v_schedule.provider_payout,
    v_new_charge_at,
    'SCHEDULED'::public.payment_schedule_state,
    0,
    0,
    v_schedule.max_attempts,
    v_idempotency,
    v_schedule.clearsale_session_id,
    v_schedule.client_ip_address,
    gen_random_uuid(),
    v_schedule.id
  );

  update public.contracted_services cs
  set
    status = 'PENDING_PAYMENT'::public.contracted_service_status,
    updated_at = now()
  where cs.id = v_schedule.contracted_service_id;

  perform public.payment_write_audit(
    p_event_type := 'FAR_RESCHEDULE_RECAPTURE_COMMITTED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := 'PAID',
    p_to_state := 'REFUNDED',
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'refund_amount', v_refund_amount,
      'new_schedule_id', v_new_id,
      'new_charge_scheduled_at', v_new_charge_at,
      'idempotency_key', v_idempotency,
      'reason', 'FAR_RESCHEDULE_RECAPTURE'
    )
  );

  perform public.payment_write_event(
    p_event_type := 'FarRescheduleRecaptureCommitted',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_payload := jsonb_build_object(
      'old_schedule_id', v_schedule.id,
      'new_schedule_id', v_new_id,
      'refund_amount', v_refund_amount
    )
  );

  return jsonb_build_object(
    'outcome', 'committed',
    'schedule_id', v_schedule.id,
    'new_schedule_id', v_new_id,
    'contracted_service_id', v_schedule.contracted_service_id,
    'refund_amount', v_refund_amount,
    'new_charge_scheduled_at', v_new_charge_at,
    'service_status', 'PENDING_PAYMENT'
  );
end;
$$;

comment on function public.payment_commit_far_reschedule_after_gateway(uuid, numeric) is
  'After gateway refund ACK: old→REFUNDED, insert new SCHEDULED T-2, CS→PENDING_PAYMENT; no chat close. service_role only.';

revoke all on function public.payment_commit_far_reschedule_after_gateway(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.payment_commit_far_reschedule_after_gateway(uuid, numeric)
  to service_role;

-- Crash recovery: gateway ACK'd but commit failed — mark SUBMITTED while still PAID+pending.
create or replace function public.payment_mark_far_recapture_gateway_acked(
  p_schedule_id uuid,
  p_refunded_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_mark_far_recapture_gateway_acked'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state <> 'PAID'::public.payment_schedule_state then
    return;
  end if;

  if v_schedule.refund_submit_status in (
    'SUBMITTED'::public.payment_refund_submit_status,
    'CONFIRMED'::public.payment_refund_submit_status
  ) then
    return;
  end if;

  update public.payment_schedules ps
  set
    refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status,
    refunded_amount = coalesce(p_refunded_amount, ps.refunded_amount),
    cancellation_reason = coalesce(ps.cancellation_reason, 'FAR_RESCHEDULE_RECAPTURE'),
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'FAR_RESCHEDULE_RECAPTURE_GATEWAY_ACK',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := 'PAID',
    p_to_state := 'PAID',
    p_actor := 'system',
    p_metadata := jsonb_build_object(
      'refund_submit_status', 'SUBMITTED',
      'refunded_amount', coalesce(p_refunded_amount, v_schedule.refunded_amount),
      'recovery', 'gateway_acked_commit_pending'
    )
  );
end;
$$;

comment on function public.payment_mark_far_recapture_gateway_acked(uuid, numeric) is
  'Crash recovery when gateway ACK''d but far-recapture commit failed. service_role only.';

revoke all on function public.payment_mark_far_recapture_gateway_acked(uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.payment_mark_far_recapture_gateway_acked(uuid, numeric)
  to service_role;

-- ---------------------------------------------------------------------------
-- Claim batch + cron safety-net
-- ---------------------------------------------------------------------------

create or replace function public.payment_claim_far_reschedule_recapture_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_results jsonb := '[]'::jsonb;
  v_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_far_reschedule_recapture_batch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('far_reschedule_recapture_batch_size', 10)
    ),
    1
  );

  for v_row in
    select ps.id as schedule_id, ps.contracted_service_id
    from public.payment_schedules ps
    where ps.state = 'PAID'::public.payment_schedule_state
      and ps.far_recapture_pending_at is not null
    order by ps.far_recapture_pending_at, ps.id
    limit v_batch_size
    for update of ps skip locked
  loop
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'schedule_id', v_row.schedule_id,
        'contracted_service_id', v_row.contracted_service_id
      )
    );
  end loop;

  return v_results;
end;
$$;

comment on function public.payment_claim_far_reschedule_recapture_batch(int) is
  'SKIP LOCKED claim of PAID schedules with far_recapture_pending_at. service_role only.';

revoke all on function public.payment_claim_far_reschedule_recapture_batch(int)
  from public, anon, authenticated;
grant execute on function public.payment_claim_far_reschedule_recapture_batch(int)
  to service_role;

create or replace function public.cron_payment_far_reschedule_recapture()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_claimed jsonb;
  v_claimed_count int;
  v_item jsonb;
  v_request_id bigint;
  v_invoked int := 0;
  v_errors int := 0;
  v_stale_minutes int;
  v_stale_count int;
  v_alerts jsonb := '[]'::jsonb;
begin
  v_job_run_id := public.job_run_begin('payment_far_reschedule_recapture', 'v1');

  -- Promote to service_role for claim RPC auth.role() checks.
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  v_claimed := public.payment_claim_far_reschedule_recapture_batch(null);
  v_claimed_count := coalesce(jsonb_array_length(v_claimed), 0);

  for v_item in
    select value
    from jsonb_array_elements(coalesce(v_claimed, '[]'::jsonb))
  loop
    begin
      if public.orbit_internal_edge_invoke_is_configured() then
        v_request_id := public.orbit_invoke_edge_function(
          'process-far-reschedule-recapture',
          v_item,
          55000
        );
        v_invoked := v_invoked + 1;
      end if;
    exception
      when others then
        v_errors := v_errors + 1;
        raise warning
          'cron_payment_far_reschedule_recapture invoke failed schedule_id=%: %',
          v_item->>'schedule_id',
          sqlerrm;
    end;
  end loop;

  v_stale_minutes := public.platform_constant_int(
    'far_reschedule_recapture_stale_minutes',
    15
  );

  select count(*)::int
  into v_stale_count
  from public.payment_schedules ps
  where ps.state = 'PAID'::public.payment_schedule_state
    and ps.far_recapture_pending_at is not null
    and ps.far_recapture_pending_at
      < now() - make_interval(mins => v_stale_minutes);

  if v_stale_count > 0 then
    -- Generic orbit-emit-sentry-alerts contract (level + message; code/count → tags/extra).
    v_alerts := jsonb_build_array(
      jsonb_build_object(
        'level', 'fatal',
        'code', 'FAR_RESCHEDULE_RECAPTURE_STALE',
        'message', format(
          '%s far-recapture pending older than %s minutes',
          v_stale_count,
          v_stale_minutes
        ),
        'count', v_stale_count
      )
    );
    perform public.orbit_post_sentry_alerts(v_alerts);
  end if;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    v_claimed_count,
    v_invoked,
    v_errors,
    jsonb_build_object(
      'claimed_count', v_claimed_count,
      'invoked_count', v_invoked,
      'stale_count', coalesce(v_stale_count, 0)
    )
  );

  return jsonb_build_object(
    'claimed_count', v_claimed_count,
    'invoked_count', v_invoked,
    'errors_count', v_errors,
    'stale_count', coalesce(v_stale_count, 0),
    'job_run_id', v_job_run_id
  );
exception
  when others then
    perform public.job_run_abort_latest('payment_far_reschedule_recapture', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_payment_far_reschedule_recapture() is
  'pg_cron safety-net: claim far-recapture pending and invoke process-far-reschedule-recapture.';

revoke all on function public.cron_payment_far_reschedule_recapture()
  from public, anon, authenticated;
grant execute on function public.cron_payment_far_reschedule_recapture() to postgres;

-- Register safety-net cron (after function exists).
do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'payment-far-reschedule-recapture';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'payment-far-reschedule-recapture',
    '*/3 * * * *',
    $$select public.cron_payment_far_reschedule_recapture();$$
  );
end;
$register$;
