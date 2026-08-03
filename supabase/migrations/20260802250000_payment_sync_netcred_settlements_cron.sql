-- GraphQL settlement reconcile: claim RPC + cron wrapper + schedule.
-- EF: sync-netcred-settlements (secondary to PAYOUT_* webhooks).

insert into public.platform_constants (key, value, description)
values (
  'settlement_sync_batch_size',
  '20'::jsonb,
  'Max PAID/REFUNDED* schedules claimed per sync-netcred-settlements cron tick'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

create or replace function public.payment_claim_schedules_for_settlement_sync(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_lease_minutes int;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_schedules_for_settlement_sync'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('settlement_sync_batch_size', 20)
    ),
    1
  );

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
      where ps.gateway_slug = 'netcred'::public.payment_gateway_slug
        and ps.state in (
          'PAID'::public.payment_schedule_state,
          'REFUNDED'::public.payment_schedule_state,
          'PARTIALLY_REFUNDED'::public.payment_schedule_state
        )
        and ps.gateway_transaction_id is not null
        and length(btrim(ps.gateway_transaction_id)) > 0
        and (ps.locked_until is null or ps.locked_until < now())
        and (
          -- Missing settlement rows (webhook gap / post-capture before PAYOUT_CREATE).
          not exists (
            select 1
            from public.payment_settlement_movements psm
            where psm.payment_schedule_id = ps.id
          )
          -- Or pending movements past settling_at still missing settled_at.
          or exists (
            select 1
            from public.payment_settlement_movements psm
            where psm.payment_schedule_id = ps.id
              and psm.settled_at is null
              and psm.settling_at is not null
              and psm.settling_at < (timezone('utc', now()))::date
          )
        )
        -- Grace window so PAYOUT_* webhook can land before GraphQL reconcile.
        and (
          ps.paid_at is null
          or ps.paid_at < now() - interval '30 minutes'
          or exists (
            select 1
            from public.payment_settlement_movements psm
            where psm.payment_schedule_id = ps.id
              and psm.settled_at is null
              and psm.settling_at is not null
              and psm.settling_at < (timezone('utc', now()))::date
          )
        )
      order by coalesce(ps.paid_at, ps.updated_at) asc
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
        ps.provider_id,
        ps.state,
        ps.gateway_transaction_id,
        ps.gateway_slug,
        ps.paid_at,
        el.netcred_company_id
    )
    select * from claimed
  loop
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'schedule_id', v_row.id,
      'provider_id', v_row.provider_id,
      'state', v_row.state,
      'gateway_transaction_id', v_row.gateway_transaction_id,
      'gateway_slug', v_row.gateway_slug,
      'paid_at', v_row.paid_at,
      'netcred_company_id', v_row.netcred_company_id
    ));
  end loop;

  return v_rows;
end;
$$;

comment on function public.payment_claim_schedules_for_settlement_sync(int) is
  'Claims PAID/REFUNDED/PARTIALLY_REFUNDED schedules needing settlement GraphQL sync (missing movements or overdue pending). service_role only.';

revoke all on function public.payment_claim_schedules_for_settlement_sync(int) from public;
revoke all on function public.payment_claim_schedules_for_settlement_sync(int) from anon;
revoke all on function public.payment_claim_schedules_for_settlement_sync(int) from authenticated;
grant execute on function public.payment_claim_schedules_for_settlement_sync(int) to service_role;

create or replace function public.payment_cron_sync_netcred_settlements()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_name constant text := 'sync-netcred-settlements';
  v_edge_slug constant text := 'sync-netcred-settlements';
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

comment on function public.payment_cron_sync_netcred_settlements() is
  'pg_cron entrypoint: invoke sync-netcred-settlements EF with job_runs telemetry.';

revoke all on function public.payment_cron_sync_netcred_settlements() from public;
revoke all on function public.payment_cron_sync_netcred_settlements() from anon;
revoke all on function public.payment_cron_sync_netcred_settlements() from authenticated;
grant execute on function public.payment_cron_sync_netcred_settlements() to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'sync-netcred-settlements';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'sync-netcred-settlements',
    '*/10 * * * *',
    $$select public.payment_cron_sync_netcred_settlements();$$
  );
end;
$register$;
