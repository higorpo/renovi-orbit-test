-- pgTAP: no-proposal seeking notify (24h) + auto-cancel (48h) lifecycle.

begin;

select plan(13);

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = 'matching.no_proposal_seeking'
      and t.channel = 'push'
      and t.active
  ),
  'matching.no_proposal_seeking push template is seeded'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = 'matching.no_proposal_auto_cancelled'
      and t.channel = 'push'
      and t.active
  )
  and exists (
    select 1
    from message_dispatcher.message_templates t
    where t.template_key = 'matching.no_proposal_auto_cancelled'
      and t.channel = 'email'
      and t.active
  ),
  'matching.no_proposal_auto_cancelled push+email templates are seeded'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'process_service_requests_without_proposals'
      and j.schedule = '*/15 * * * *'
      and j.command like '%cron_process_service_requests_without_proposals%'
  ),
  'no-proposal lifecycle cron is scheduled every 15 minutes'
);

select throws_ok(
  $$ select public.process_service_requests_without_proposals(501) $$,
  '22023',
  'p_batch_size must be between 1 and 500',
  'lifecycle job rejects oversized batch'
);

select ok(
  has_function_privilege('postgres', 'public.cron_process_service_requests_without_proposals()', 'EXECUTE')
    and not has_function_privilege(
      'authenticated',
      'public.process_service_requests_without_proposals(int)',
      'EXECUTE'
    ),
  'cron entrypoint is postgres-only; batch RPC denied to authenticated'
);

create temp table _np_fixture as
select
  gen_random_uuid() as seeking_sr_id,
  gen_random_uuid() as cancel_sr_id,
  gen_random_uuid() as with_proposal_sr_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as client_id;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency,
  created_at
)
select
  f.seeking_sr_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'No proposal seeking fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency,
  now() - interval '25 hours'
from public.service_requests sr
cross join _np_fixture f
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency,
  created_at
)
select
  f.cancel_sr_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'No proposal cancel fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency,
  now() - interval '49 hours'
from public.service_requests sr
cross join _np_fixture f
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_requests (
  id,
  client_id,
  service_id,
  address_id,
  title,
  description,
  form_data,
  form_version,
  status,
  urgency,
  created_at
)
select
  f.with_proposal_sr_id,
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'Has proposal skip fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency,
  now() - interval '50 hours'
from public.service_requests sr
cross join _np_fixture f
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

-- Minimal proposal row so the 50h SR is excluded from auto-cancel.
do $proposal$
declare
  v_pricing record;
begin
  perform pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id,
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    proposal_duration_value,
    proposal_duration_unit,
    proposal_suggested_slots,
    photos,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status,
    submitted_at
  )
  values (
    gen_random_uuid(),
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    (select with_proposal_sr_id from _np_fixture),
    v_pricing.original_amount,
    'no proposal lifecycle skip fixture',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', (current_date + 3)::text,
        'shift', 'morning'
      )
    ),
    '{}'::text[],
    v_pricing.tax_rate,
    v_pricing.tax_amount,
    v_pricing.final_amount,
    v_pricing.pricing_signature,
    'PENDING'::public.proposal_status,
    now()
  );
end;
$proposal$;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select client_id from _np_fixture
on conflict (profile_id) do nothing;

create temp table _np_first_run as
select public.process_service_requests_without_proposals(50) as payload;

select ok(
  ((_np_first_run.payload)->>'seeking_notified_count')::int >= 1,
  'first run notifies at least one seeking (24h) client'
)
from _np_first_run;

select ok(
  ((_np_first_run.payload)->>'cancelled_count')::int >= 1,
  'first run auto-cancels at least one 48h OPEN without proposals'
)
from _np_first_run;

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.profile_id = (select client_id from _np_fixture)
      and d.template_key = 'matching.no_proposal_seeking'
      and d.channel = 'push'
      and d.idempotency_key = public.mmd_idempotency_uuid(
        format(
          'service_request:%s:no_proposal_seeking:push',
          (select seeking_sr_id from _np_fixture)
        )
      )
  ),
  '24h seeking push was enqueued for the seeking fixture'
);

select is(
  (
    select sr.status::text
    from public.service_requests sr
    where sr.id = (select cancel_sr_id from _np_fixture)
  ),
  'CANCELLED',
  '48h fixture is CANCELLED'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.profile_id = (select client_id from _np_fixture)
      and d.template_key = 'matching.no_proposal_auto_cancelled'
      and d.channel = 'push'
  )
  and exists (
    select 1
    from message_dispatcher.message_dispatches d
    where d.profile_id = (select client_id from _np_fixture)
      and d.template_key = 'matching.no_proposal_auto_cancelled'
      and d.channel = 'email'
  ),
  '48h auto-cancel enqueues push and email'
);

select is(
  (
    select sr.status::text
    from public.service_requests sr
    where sr.id = (select with_proposal_sr_id from _np_fixture)
  ),
  'OPEN',
  'SR with any proposal is not auto-cancelled'
);

select is(
  (
    select sr.status::text
    from public.service_requests sr
    where sr.id = (select seeking_sr_id from _np_fixture)
  ),
  'OPEN',
  '24h seeking fixture remains OPEN'
);

-- Idempotent re-run should not double-notify seeking or re-cancel
select public.process_service_requests_without_proposals(50);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches d
    where d.idempotency_key = public.mmd_idempotency_uuid(
      format(
        'service_request:%s:no_proposal_seeking:push',
        (select seeking_sr_id from _np_fixture)
      )
    )
  ),
  1,
  'seeking notify remains idempotent across cron ticks'
);

select finish();

rollback;
