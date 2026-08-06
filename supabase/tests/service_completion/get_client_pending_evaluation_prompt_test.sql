-- pgTAP: get_client_pending_evaluation_prompt — eligible most recent, grace, IDOR, ordering.
-- Uses dedicated actors (not shared seed clients) to avoid parallel-suite pollution.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(14);

select set_config('rls.client_id', gen_random_uuid()::text, true);
select set_config('rls.other_client_id', gen_random_uuid()::text, true);
select set_config('rls.provider_id', gen_random_uuid()::text, true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(
  current_setting('rls.client_id')::uuid, 'client', 'Pending eval client'
);
select pg_temp.rls_seed_user(
  current_setting('rls.other_client_id')::uuid, 'client', 'Pending eval other client'
);
select pg_temp.rls_seed_user(
  current_setting('rls.provider_id')::uuid, 'provider', 'Pending eval provider'
);

-- ---------------------------------------------------------------------------
-- Existence + grants
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_client_pending_evaluation_prompt'
      and pg_get_function_identity_arguments(p.oid) = ''
  ),
  'get_client_pending_evaluation_prompt() exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_client_pending_evaluation_prompt()'::regprocedure,
    'EXECUTE'
  ),
  'authenticated can execute get_client_pending_evaluation_prompt'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_client_pending_evaluation_prompt()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute get_client_pending_evaluation_prompt'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'contracted_services_client_executed_at_pending_eval_idx'
  ),
  'partial index contracted_services_client_executed_at_pending_eval_idx exists'
);

-- ---------------------------------------------------------------------------
-- Fixtures: two within-grace EXECUTED (older + newer) + one past-grace
-- ---------------------------------------------------------------------------

create temp table _fx as
select
  gen_random_uuid() as sr_older,
  gen_random_uuid() as prop_older,
  gen_random_uuid() as cs_older,
  gen_random_uuid() as sr_newer,
  gen_random_uuid() as prop_newer,
  gen_random_uuid() as cs_newer,
  gen_random_uuid() as sr_past,
  gen_random_uuid() as prop_past,
  gen_random_uuid() as cs_past,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.other_client_id')::uuid as other_client_id,
  current_setting('rls.provider_id')::uuid as provider_id,
  (current_date - 3) as scheduled_start;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  x.title,
  sr.description, sr.form_data, sr.form_version,
  'OPEN', sr.urgency
from _fx f
cross join lateral (
  select sr_older as sr_id, 'pending eval older' as title from _fx
  union all select sr_newer, 'pending eval newer' from _fx
  union all select sr_past, 'pending eval past grace' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb;
  v_grace int;
  v_category text;
  v_provider_name text;
  v_scheduled date;
begin
  v_grace := public.platform_constant_int('auto_complete_grace_hours', 24);

  select scheduled_start into v_scheduled from _fx;
  v_slot := jsonb_build_object(
    'start_date', to_char(v_scheduled, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  select ps.title into v_category
  from public.service_requests sr
  join public.platform_services ps on ps.id = sr.service_id
  where sr.id = (select sr_newer from _fx);

  select full_name into v_provider_name
  from public.profiles
  where id = current_setting('rls.provider_id')::uuid;

  perform set_config('rls.expected_category', coalesce(v_category, ''), true);
  perform set_config('rls.expected_provider_name', coalesce(v_provider_name, ''), true);

  perform pg_temp.rls_set_jwt(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('pending eval %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_older as prop_id, sr_older as sr_id, 'older' as label from _fx
    union all select prop_newer, sr_newer, 'newer' from _fx
    union all select prop_past, sr_past, 'past' from _fx
  ) x;

  -- Older within grace: closer to the cutoff (further in the past).
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_older, f.sr_older, f.prop_older, f.client_id, f.provider_id,
    'days', 1, f.scheduled_start, f.scheduled_start, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - make_interval(hours => greatest(v_grace - 2, 1))
  from _fx f;

  -- Newer within grace: closer to now (must win ORDER BY executed_at DESC).
  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_newer, f.sr_newer, f.prop_newer, f.client_id, f.provider_id,
    'days', 1, f.scheduled_start, f.scheduled_start, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '1 hour'
  from _fx f;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    f.cs_past, f.sr_past, f.prop_past, f.client_id, f.provider_id,
    'days', 1, f.scheduled_start, f.scheduled_start, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - make_interval(hours => v_grace + 2)
  from _fx f;

  reset role;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- Auth required
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_anon();

select throws_ok(
  $$ select public.get_client_pending_evaluation_prompt() $$,
  '42501',
  'Authentication required for get_client_pending_evaluation_prompt',
  'unauthenticated call raises 42501'
);

-- ---------------------------------------------------------------------------
-- Multiple EXECUTED within grace → most recent (+ payload shape)
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _prompt as
select public.get_client_pending_evaluation_prompt() as payload;

select is(
  (_prompt.payload->>'contracted_service_id')::uuid,
  (select cs_newer from _fx),
  'multiple EXECUTED within grace: returns most recent by executed_at'
)
from _prompt;

select is(
  (_prompt.payload->>'service_request_id')::uuid,
  (select sr_newer from _fx),
  'payload service_request_id matches most recent CS'
)
from _prompt;

select is(
  _prompt.payload->>'title',
  'pending eval newer',
  'payload title comes from service_requests'
)
from _prompt;

select is(
  _prompt.payload->>'provider_full_name',
  current_setting('rls.expected_provider_name'),
  'payload provider_full_name comes from profiles'
)
from _prompt;

select is(
  _prompt.payload->>'category_title',
  nullif(current_setting('rls.expected_category'), ''),
  'payload category_title comes from platform_services'
)
from _prompt;

select is(
  (_prompt.payload->>'scheduled_start_date')::date,
  (select scheduled_start from _fx),
  'payload scheduled_start_date matches contracted_services'
)
from _prompt;

select is(
  (_prompt.payload->>'scheduled_end_date')::date,
  (select scheduled_start from _fx),
  'payload scheduled_end_date matches contracted_services'
)
from _prompt;

-- ---------------------------------------------------------------------------
-- Other client → null (IDOR / ownership)
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.other_client_id')::uuid);

select is(
  public.get_client_pending_evaluation_prompt(),
  null::jsonb,
  'other client with no eligible EXECUTED gets null'
);

-- ---------------------------------------------------------------------------
-- Outside grace only → null
-- ---------------------------------------------------------------------------

update public.contracted_services cs
set executed_at = now() - make_interval(
  hours => public.platform_constant_int('auto_complete_grace_hours', 24) + 3
)
from _fx f
where cs.id in (f.cs_older, f.cs_newer);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  public.get_client_pending_evaluation_prompt(),
  null::jsonb,
  'outside grace: all EXECUTED past cutoff → null'
);

select * from finish();
rollback;
