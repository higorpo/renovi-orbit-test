-- pgTAP: incomplete provider onboarding reminder enqueue (push+email via MMD).

begin;

select plan(10);

create or replace function pg_temp.payment_set_service_role()
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

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'job_run_begin'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_enqueue_provider_onboarding_incomplete_reminders'
  ),
  'cron wrapper records job_runs telemetry'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_enqueue_provider_onboarding_incomplete_reminders()'::regprocedure,
    'EXECUTE'
  ),
  'postgres can execute cron wrapper'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cron_enqueue_provider_onboarding_incomplete_reminders()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'enqueue_provider_onboarding_incomplete_reminders'
  ),
  'pg_cron job is registered'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = 'account.provider_onboarding_incomplete_reminder'
      and t.channel = 'push'
      and t.active
  )
  and exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = 'account.provider_onboarding_incomplete_reminder'
      and t.channel = 'email'
      and t.active
  ),
  'push and email reminder templates are seeded'
);

do $seed$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_account_id uuid;
begin
  delete from public.provider_gateway_accounts
  where provider_id = v_provider_id
    and gateway_slug = 'netcred'::public.payment_gateway_slug;

  insert into public.provider_gateway_accounts (
    provider_id,
    gateway_slug,
    document,
    onboarding_status,
    onboarding_reminder_count,
    last_onboarding_reminder_at,
    created_at
  )
  values (
    v_provider_id,
    'netcred',
    '12345678901',
    'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status,
    0,
    null,
    now() - interval '48 hours'
  )
  returning id into v_account_id;

  perform set_config('test.onboarding.reminder_account_id', v_account_id::text, true);
end;
$seed$;

select lives_ok(
  $$ select public.enqueue_provider_onboarding_incomplete_reminders(10) $$,
  'enqueue runs for due PENDING_DOCUMENTS account'
);

select is(
  (
    select onboarding_reminder_count
    from public.provider_gateway_accounts
    where id = current_setting('test.onboarding.reminder_account_id')::uuid
  ),
  1,
  'reminder count increments after enqueue'
);

select ok(
  (
    select last_onboarding_reminder_at is not null
    from public.provider_gateway_accounts
    where id = current_setting('test.onboarding.reminder_account_id')::uuid
  ),
  'last_onboarding_reminder_at is set'
);

select ok(
  (
    select count(*) >= 2
    from message_dispatcher.message_dispatches d
    where d.metadata->>'event_type' = 'PROVIDER_ONBOARDING_INCOMPLETE_REMINDER'
      and d.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'push and email dispatches were ingested'
);

-- Interval not elapsed → second run should skip.
select is(
  (
    select (public.enqueue_provider_onboarding_incomplete_reminders(10)->>'enqueued_count')::int
  ),
  0,
  'second enqueue within interval does not re-notify'
);

select * from finish();
rollback;
