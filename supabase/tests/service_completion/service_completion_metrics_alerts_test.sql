-- pgTAP: Task 56 — service_completion_ops_metrics + evaluate_sentry_alerts.

begin;

select plan(9);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select throws_ok(
  $$ select public.service_completion_ops_metrics(24) $$,
  '42501',
  null,
  'ops_metrics rejects non-service_role'
);

select throws_ok(
  $$ select public.service_completion_evaluate_sentry_alerts() $$,
  '42501',
  null,
  'evaluate_sentry_alerts rejects non-service_role'
);

select pg_temp.set_service_role();

select ok(
  (public.service_completion_ops_metrics(24) ? 'enrichment_age')
    and (public.service_completion_ops_metrics(24) ? 'ai_vs_fallback')
    and (public.service_completion_ops_metrics(24) ? 'executed_late')
    and (public.service_completion_ops_metrics(24) ? 'auto_vs_manual_complete')
    and (public.service_completion_ops_metrics(24) ? 'ops_attention_open_count'),
  'ops_metrics returns expected metric keys'
);

-- Seed ops_attention enrichment → CRITICAL alert
create temp table _fx as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'metrics alerts pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count,
  ops_attention_at, ops_attention_reason
)
select
  enr_id, sr_id, 'PENDING'::public.enrichment_status, 3,
  now(), 'TEMPLATE_CASCADE_MISSING'
from _fx;

select ok(
  (
    select count(*)::int
    from jsonb_array_elements(public.service_completion_evaluate_sentry_alerts()) a
    where a.value->>'code' = 'OPS_ATTENTION'
      and a.value->>'level' = 'CRITICAL'
  ) >= 1,
  'ops_attention open rows emit CRITICAL OPS_ATTENTION alert'
);

select ok(
  (
    select (public.service_completion_ops_metrics(24)->>'ops_attention_open_count')::int
  ) >= 1,
  'ops_metrics counts open ops_attention'
);

-- Stale PENDING (no ops_attention) older than warning threshold
create temp table _fx2 as
select
  gen_random_uuid() as sr_id,
  gen_random_uuid() as enr_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  f.sr_id, sr.client_id, sr.service_id, sr.address_id,
  'pending age pgTAP', sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx2 f
join public.service_requests sr on sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_enrichments (
  id, service_request_id, status, attempt_count, created_at, updated_at
)
select
  enr_id, sr_id, 'PENDING'::public.enrichment_status, 0,
  now() - interval '2 hours', now() - interval '2 hours'
from _fx2;

select ok(
  (
    select count(*)::int
    from jsonb_array_elements(public.service_completion_evaluate_sentry_alerts()) a
    where a.value->>'code' in ('PENDING_AGE_WARNING', 'PENDING_AGE_CRITICAL')
  ) >= 1,
  'aged PENDING (excl ops_attention) emits PENDING_AGE alert'
);

-- Consecutive auto-complete errors → WARNING
insert into public.job_runs (
  job_name, started_at, finished_at, duration_ms,
  processed_count, error_count, metadata
)
values
  (
    'service_completion_cron_auto_complete_executed',
    now() - interval '2 hours',
    now() - interval '2 hours' + interval '1 minute',
    1000,
    1,
    2,
    '{}'::jsonb
  ),
  (
    'service_completion_cron_auto_complete_executed',
    now() - interval '1 hour',
    now() - interval '1 hour' + interval '1 minute',
    1000,
    1,
    1,
    '{}'::jsonb
  );

select ok(
  (
    select count(*)::int
    from jsonb_array_elements(public.service_completion_evaluate_sentry_alerts()) a
    where a.value->>'code' = 'AUTO_COMPLETE_JOB_ERRORS'
      and a.value->>'level' = 'WARNING'
  ) >= 1,
  'consecutive auto-complete errors emit WARNING'
);

select ok(
  to_regprocedure('public.service_completion_cron_emit_sentry_alerts()') is not null,
  'cron emit wrapper exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'service_completion_prune_enrichment_events'
  ),
  'pg_cron job service_completion_prune_enrichment_events is scheduled'
);

select finish();

rollback;
