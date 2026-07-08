-- Service reschedule: expire stale open requests (terminal service or 24h past original execution).

create or replace function public.expire_stale_service_reschedule_requests(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processed int := 0;
  v_expired int := 0;
  v_skipped int := 0;
  v_error_count int := 0;
  v_row record;
  v_batch_size int;
  v_grace_hours int := public.platform_constant_int('service_reschedule.expiration_grace_hours', 24);
  v_system_text text := 'A solicitação de reagendamento expirou porque o serviço seguiu a data original ou entrou em estado final.';
begin
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('service_reschedule.batch_size', 50)
    ),
    1
  );

  if v_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  for v_row in
    select
      srr.id as request_id,
      srr.chat_id,
      srr.status
    from public.service_reschedule_requests srr
    inner join public.contracted_services cs on cs.id = srr.contracted_service_id
    where srr.status in (
      'REQUESTED'::public.service_reschedule_request_status,
      'PROPOSED'::public.service_reschedule_request_status,
      'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
    )
      and (
        cs.status in (
          'EXECUTED'::public.contracted_service_status,
          'COMPLETED'::public.contracted_service_status,
          'CANCELLED'::public.contracted_service_status
        )
        or (
          cs.status = 'CONFIRMED'::public.contracted_service_status
          and now() > srr.original_service_execution_at + make_interval(hours => v_grace_hours)
        )
      )
    order by srr.created_at
    limit v_batch_size
    for update of srr skip locked
  loop
    begin
      v_processed := v_processed + 1;

      update public.service_reschedule_requests srr
      set status = 'EXPIRED'::public.service_reschedule_request_status
      where srr.id = v_row.request_id
        and srr.status in (
          'REQUESTED'::public.service_reschedule_request_status,
          'PROPOSED'::public.service_reschedule_request_status,
          'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
        );

      if not found then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.chat_messages (
        chat_id,
        sender_user_id,
        message_type,
        payload,
        linked_entity_type,
        linked_entity_id,
        idempotency_key
      )
      values (
        v_row.chat_id,
        null,
        'SYSTEM'::public.cns_message_type,
        jsonb_build_object('text', v_system_text),
        'workflow',
        v_row.request_id,
        public.mmd_idempotency_uuid(format('service_reschedule:%s:expired', v_row.request_id))
      )
      on conflict (chat_id, sender_user_id, idempotency_key) do nothing;

      v_expired := v_expired + 1;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'expire_stale_service_reschedule_requests row_error request_id=% sqlstate=% message=%',
          v_row.request_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'processed_count', v_processed,
    'expired_count', v_expired,
    'skipped_count', v_skipped,
    'error_count', v_error_count
  );
end;
$$;

comment on function public.expire_stale_service_reschedule_requests(int) is
  'Expire open reschedule requests when service is terminal or grace hours past original execution while CONFIRMED.';

revoke all on function public.expire_stale_service_reschedule_requests(int) from public, anon, authenticated;
grant execute on function public.expire_stale_service_reschedule_requests(int) to service_role, postgres;

create or replace function public.cron_expire_stale_service_reschedule_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'expire_stale_service_reschedule_requests';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_result := public.expire_stale_service_reschedule_requests();
    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      coalesce((v_result->>'processed_count')::int, 0),
      coalesce((v_result->>'expired_count')::int, 0),
      coalesce((v_result->>'error_count')::int, 0),
      v_result,
      null
    );
    return v_result;
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.cron_expire_stale_service_reschedule_requests() is
  'pg_cron entrypoint: expire stale service reschedule requests with job_runs telemetry.';

revoke all on function public.cron_expire_stale_service_reschedule_requests() from public, anon, authenticated;
grant execute on function public.cron_expire_stale_service_reschedule_requests() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'expire_stale_service_reschedule_requests';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'expire_stale_service_reschedule_requests',
  '*/15 * * * *',
  $$select public.cron_expire_stale_service_reschedule_requests();$$
);
