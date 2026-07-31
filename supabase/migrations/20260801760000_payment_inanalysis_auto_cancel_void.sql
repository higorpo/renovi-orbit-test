-- Payment Task 113: IN_ANALYSIS T-12h auto-cancel gateway void I/O path (design.md §4.12, Req 14.5–14.6).

create or replace function public.payment_claim_inanalysis_auto_cancel_void_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_max_failures int;
  v_lease_minutes int;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_inanalysis_auto_cancel_void_batch'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('inanalysis_void_reconcile_batch_size', 25)
    ),
    1
  );

  v_max_failures := public.platform_constant_int('inanalysis_void_reconcile_max_failures', 5);
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);

  for v_row in
    with eligible as (
      select
        ps.id,
        pga.netcred_company_id
      from public.payment_schedules ps
      join public.provider_gateway_accounts pga
        on pga.provider_id = ps.provider_id
       and pga.gateway_slug = ps.gateway_slug
      where ps.state = 'CANCELLED'::public.payment_schedule_state
        and ps.gateway_charge_id is not null
        and ps.reconciliation_failure_count < v_max_failures
        and (ps.locked_until is null or ps.locked_until < now())
        and exists (
          select 1
          from public.payment_audit_log pal
          where pal.schedule_id = ps.id
            and pal.event_type = 'AUTO_CANCELLED'
            and pal.from_state = 'IN_ANALYSIS'
        )
        and not exists (
          select 1
          from public.payment_audit_log pal2
          where pal2.schedule_id = ps.id
            and pal2.event_type = 'IN_ANALYSIS_VOID_RECONCILED'
        )
      order by ps.updated_at
      limit v_batch_size
      for update of ps skip locked
    ),
    claimed as (
      update public.payment_schedules ps
      set locked_until = now() + make_interval(mins => v_lease_minutes)
      from eligible el
      where ps.id = el.id
      returning
        ps.id,
        ps.contracted_service_id,
        ps.client_id,
        ps.provider_id,
        ps.gateway_charge_id,
        ps.gateway_transaction_id,
        ps.reconciliation_failure_count,
        el.netcred_company_id
    )
    select * from claimed
  loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_row.id,
      'contracted_service_id', v_row.contracted_service_id,
      'client_id', v_row.client_id,
      'provider_id', v_row.provider_id,
      'gateway_charge_id', v_row.gateway_charge_id,
      'gateway_transaction_id', v_row.gateway_transaction_id,
      'reconciliation_failure_count', v_row.reconciliation_failure_count,
      'netcred_company_id', v_row.netcred_company_id
    ));
  end loop;

  return v_rows;
end;
$$;

comment on function public.payment_claim_inanalysis_auto_cancel_void_batch(int) is
  'Claims CANCELLED IN_ANALYSIS auto-cancel schedules pending gateway chargeVoid (service_role only).';

revoke all on function public.payment_claim_inanalysis_auto_cancel_void_batch(int) from public;
revoke all on function public.payment_claim_inanalysis_auto_cancel_void_batch(int) from anon;
revoke all on function public.payment_claim_inanalysis_auto_cancel_void_batch(int) from authenticated;

grant execute on function public.payment_claim_inanalysis_auto_cancel_void_batch(int) to service_role;

create or replace function public.payment_commit_inanalysis_auto_cancel_void_outcome(
  p_schedule_id uuid,
  p_outcome text,
  p_gateway_state text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_outcome text;
  v_gateway_state text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_commit_inanalysis_auto_cancel_void_outcome'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  v_outcome := lower(btrim(coalesce(p_outcome, '')));
  if v_outcome not in ('voided', 'deferred_captured', 'already_terminal', 'failed') then
    raise exception 'unsupported outcome: %', p_outcome
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'schedule_not_found');
  end if;

  if v_schedule.state <> 'CANCELLED'::public.payment_schedule_state then
    update public.payment_schedules ps
    set locked_until = null
    where ps.id = v_schedule.id;

    return jsonb_build_object(
      'applied', false,
      'reason', 'schedule_not_cancelled',
      'schedule_state', v_schedule.state::text
    );
  end if;

  v_gateway_state := upper(btrim(coalesce(p_gateway_state, '')));

  if v_outcome = 'failed' then
    update public.payment_schedules ps
    set
      reconciliation_failure_count = ps.reconciliation_failure_count + 1,
      locked_until = null,
      updated_at = now()
    where ps.id = v_schedule.id
    returning ps.reconciliation_failure_count into v_schedule.reconciliation_failure_count;

    perform public.payment_write_audit(
      p_event_type := 'IN_ANALYSIS_VOID_FAILED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule.id,
      p_service_id := v_schedule.contracted_service_id,
      p_schedule_id := v_schedule.id,
      p_from_state := v_schedule.state::text,
      p_to_state := v_schedule.state::text,
      p_actor := 'system'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'gateway_state', nullif(v_gateway_state, ''),
        'error_message', p_error_message
      )
    );

    return jsonb_build_object(
      'applied', true,
      'outcome', 'failed',
      'reconciliation_failure_count', v_schedule.reconciliation_failure_count
    );
  end if;

  update public.payment_schedules ps
  set
    locked_until = null,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.payment_write_audit(
    p_event_type := 'IN_ANALYSIS_VOID_RECONCILED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := v_schedule.state::text,
    p_actor := 'system'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'outcome', v_outcome,
      'gateway_state', nullif(v_gateway_state, '')
    )
  );

  return jsonb_build_object(
    'applied', true,
    'outcome', v_outcome,
    'schedule_id', v_schedule.id,
    'service_id', v_schedule.contracted_service_id
  );
end;
$$;

comment on function public.payment_commit_inanalysis_auto_cancel_void_outcome(uuid, text, text, text) is
  'Records gateway void reconcile outcome for IN_ANALYSIS auto-cancel rows (service_role only).';

revoke all on function public.payment_commit_inanalysis_auto_cancel_void_outcome(uuid, text, text, text) from public;
revoke all on function public.payment_commit_inanalysis_auto_cancel_void_outcome(uuid, text, text, text) from anon;
revoke all on function public.payment_commit_inanalysis_auto_cancel_void_outcome(uuid, text, text, text) from authenticated;

grant execute on function public.payment_commit_inanalysis_auto_cancel_void_outcome(uuid, text, text, text) to service_role;

create or replace function public.payment_cron_reconcile_inanalysis_auto_cancel_voids()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'reconcile-inanalysis-auto-cancel-voids';
  v_edge_slug constant text := 'reconcile-inanalysis-auto-cancel-voids';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_request_id bigint;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_request_id := public.payment_cron_invoke_edge_function(v_edge_slug);

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      0,
      0,
      0,
      jsonb_build_object(
        'pg_net_request_id', v_request_id,
        'edge_function', v_edge_slug
      ),
      null
    );
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.payment_cron_reconcile_inanalysis_auto_cancel_voids() is
  'pg_cron entrypoint: invoke reconcile-inanalysis-auto-cancel-voids EF with job_runs telemetry.';

revoke all on function public.payment_cron_reconcile_inanalysis_auto_cancel_voids() from public;
revoke all on function public.payment_cron_reconcile_inanalysis_auto_cancel_voids() from anon;
revoke all on function public.payment_cron_reconcile_inanalysis_auto_cancel_voids() from authenticated;

grant execute on function public.payment_cron_reconcile_inanalysis_auto_cancel_voids() to postgres;

create or replace function public.payment_cron_auto_cancel_unpaid_services()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'auto-cancel-unpaid-services';
  v_void_edge_slug constant text := 'reconcile-inanalysis-auto-cancel-voids';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_cancelled_count int;
  v_error_count int;
  v_sentry_alerts jsonb;
  v_requires_void_reconcile boolean := false;
  v_void_request_id bigint;
  v_item jsonb;
  v_schedule_id uuid;
  v_mmd_errors int := 0;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.payment_auto_cancel_services();
    v_cancelled_count := coalesce((v_result->>'cancelled_count')::int, 0);
    v_error_count := coalesce((v_result->>'errors_count')::int, 0);

    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_result->'cancelled', '[]'::jsonb))
    loop
      v_schedule_id := (v_item->>'schedule_id')::uuid;

      begin
        perform public.payment_enqueue_notifications(
          v_schedule_id,
          'SERVICE_AUTO_CANCELLED',
          jsonb_build_object(
            'source', 'auto_cancel_unpaid_services',
            'cancellation_reason', v_item->>'cancellation_reason'
          )
        );
      exception
        when others then
          v_mmd_errors := v_mmd_errors + 1;
          raise warning
            'auto_cancel notification enqueue failed schedule_id=% sqlstate=% message=%',
            v_schedule_id,
            sqlstate,
            sqlerrm;
      end;
    end loop;

    select exists (
      select 1
      from jsonb_array_elements(coalesce(v_result->'cancelled', '[]'::jsonb)) as item
      where coalesce((item->>'requires_gateway_reconcile')::boolean, false)
    )
    into v_requires_void_reconcile;

    -- Void invoke must not poison CANCELLED commits from payment_auto_cancel_services.
    if v_requires_void_reconcile then
      begin
        v_void_request_id := public.payment_cron_invoke_edge_function(v_void_edge_slug);
      exception
        when others then
          raise warning
            'inanalysis void reconcile invoke failed sqlstate=% message=%',
            sqlstate,
            sqlerrm;
      end;
    end if;

    if v_cancelled_count > 0 then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'kind', 'auto_cancel',
            'service_id', item->>'service_id',
            'schedule_id', item->>'schedule_id',
            'last_failure_reason', item->>'last_failure_reason'
          )
        ),
        '[]'::jsonb
      )
      into v_sentry_alerts
      from jsonb_array_elements(v_result->'cancelled') as item;

      perform public.orbit_post_sentry_alerts(v_sentry_alerts);
    end if;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_cancelled_count + v_error_count,
      v_cancelled_count,
      v_error_count,
      jsonb_build_object(
        'cancelled', v_result->'cancelled',
        'cancelled_count', v_cancelled_count,
        'errors_count', v_error_count,
        'mmd_errors_count', v_mmd_errors,
        'inanalysis_void_reconcile_invoked', v_requires_void_reconcile,
        'inanalysis_void_pg_net_request_id', v_void_request_id
      ),
      null
    );
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

grant usage on schema cron to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'reconcile-inanalysis-auto-cancel-voids';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'reconcile-inanalysis-auto-cancel-voids',
    '*/30 * * * *',
    $$select public.payment_cron_reconcile_inanalysis_auto_cancel_voids();$$
  );
end;
$register$;
