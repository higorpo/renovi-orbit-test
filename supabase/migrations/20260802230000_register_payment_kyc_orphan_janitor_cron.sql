-- Register daily cron for payment KYC orphan document janitor (job_runs telemetry).

create or replace function public.cron_payment_janitor_orphan_kyc_documents()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_job_run_id bigint;
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin('payment_janitor_orphan_kyc_documents', 'v1');
  v_result := public.payment_janitor_orphan_kyc_documents(500);

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    coalesce((v_result->>'processed_count')::int, 0),
    coalesce((v_result->>'expired_count')::int, 0),
    coalesce((v_result->>'delete_failures')::int, 0),
    jsonb_build_object(
      'bytes_deleted', coalesce((v_result->>'bytes_deleted')::bigint, 0),
      'objects_deleted', coalesce((v_result->>'objects_deleted')::int, 0)
    )
  );

  return v_result || jsonb_build_object('job_run_id', v_job_run_id);
exception
  when others then
    perform public.job_run_abort_latest('payment_janitor_orphan_kyc_documents', sqlerrm);
    raise;
end;
$$;

comment on function public.cron_payment_janitor_orphan_kyc_documents() is
  'pg_cron wrapper: payment_janitor_orphan_kyc_documents with job_runs telemetry.';

revoke all on function public.cron_payment_janitor_orphan_kyc_documents() from public;
revoke all on function public.cron_payment_janitor_orphan_kyc_documents() from authenticated;
revoke all on function public.cron_payment_janitor_orphan_kyc_documents() from anon;

grant execute on function public.cron_payment_janitor_orphan_kyc_documents() to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'payment_janitor_orphan_kyc_documents';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'payment_janitor_orphan_kyc_documents',
    '0 4 * * *',
    $$select public.cron_payment_janitor_orphan_kyc_documents();$$
  );
end;
$register$;
