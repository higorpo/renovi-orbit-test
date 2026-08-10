-- pgTAP: service dispute MVP — open/guards, race vs auto-complete, cancel blocked,
-- admin resolve, list_phase, MMD routing, completion context capabilities.

begin;

\ir fixtures/seed_rls_actors.inc

select plan(23);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.template_sr', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

-- ---------------------------------------------------------------------------
-- Catalog / routing smoke
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.service_dispute_opened'
      and mt.channel = 'push'
      and mt.active
  )
  and exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'service.service_dispute_resolved'
      and mt.channel = 'email'
      and mt.active
  ),
  'MMD dispute templates seeded (push opened + email resolved)'
);

select is(
  public.derive_service_list_phase(
    'COMPLETED'::public.service_request_status,
    'IN_DISPUTE'::public.contracted_service_status,
    'client',
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_id')::uuid
  ),
  'dispute',
  'derive_service_list_phase returns dispute for IN_DISPUTE (client)'
);

select is(
  public.derive_service_list_phase(
    'COMPLETED'::public.service_request_status,
    'IN_DISPUTE'::public.contracted_service_status,
    'provider',
    current_setting('rls.provider_id')::uuid,
    current_setting('rls.provider_id')::uuid
  ),
  'dispute',
  'derive_service_list_phase returns dispute for IN_DISPUTE (provider)'
);

-- ---------------------------------------------------------------------------
-- Fixtures: EXECUTED CS rows for open / race / resolve / cancel
-- ---------------------------------------------------------------------------

create temp table _fx as
select
  gen_random_uuid() as sr_open,
  gen_random_uuid() as prop_open,
  gen_random_uuid() as cs_open,
  gen_random_uuid() as enr_open,
  gen_random_uuid() as chat_open,
  gen_random_uuid() as sr_race,
  gen_random_uuid() as prop_race,
  gen_random_uuid() as cs_race,
  gen_random_uuid() as enr_race,
  gen_random_uuid() as sr_guard,
  gen_random_uuid() as prop_guard,
  gen_random_uuid() as cs_guard,
  gen_random_uuid() as enr_guard,
  gen_random_uuid() as sr_cancel,
  gen_random_uuid() as prop_cancel,
  gen_random_uuid() as cs_cancel,
  gen_random_uuid() as enr_cancel,
  gen_random_uuid() as admin_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_id')::uuid as provider_id;

insert into public.service_requests (
  id, client_id, service_id, address_id, title, description,
  form_data, form_version, status, urgency
)
select
  x.sr_id, f.client_id, sr.service_id, sr.address_id,
  format('dispute %s', x.label),
  sr.description, sr.form_data, sr.form_version,
  'COMPLETED', sr.urgency
from _fx f
cross join lateral (
  select sr_open as sr_id, 'open' as label from _fx
  union all select sr_race, 'race' from _fx
  union all select sr_guard, 'guard' from _fx
  union all select sr_cancel, 'cancel' from _fx
) x
join public.service_requests sr on sr.id = current_setting('rls.template_sr')::uuid;

do $seed$
declare
  v_pricing record;
  v_slot jsonb := jsonb_build_object(
    'start_date', to_char(current_date - 5, 'YYYY-MM-DD'),
    'shift', 'morning'
  );
  v_schema jsonb;
begin
  select checklist_schema into v_schema
  from public.completion_checklist_templates
  where is_global and is_active
  limit 1;

  perform pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);
  select * into v_pricing from public.calculate_provider_service_pricing(100.00::numeric);

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  select
    x.prop_id, f.provider_id, x.sr_id, v_pricing.original_amount,
    format('dispute %s', x.label),
    1, 'days', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  from _fx f
  cross join lateral (
    select prop_open as prop_id, sr_open as sr_id, 'o' as label from _fx
    union all select prop_race, sr_race, 'r' from _fx
    union all select prop_guard, sr_guard, 'g' from _fx
    union all select prop_cancel, sr_cancel, 'c' from _fx
  ) x;

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date, scheduled_shift,
    agreed_slot, status, executed_at
  )
  select
    x.cs_id, x.sr_id, x.prop_id, f.client_id, f.provider_id,
    'days', 1, current_date - 5, current_date - 5, 'morning', v_slot,
    'EXECUTED'::public.contracted_service_status,
    now() - interval '48 hours'
  from _fx f
  cross join lateral (
    select cs_open as cs_id, sr_open as sr_id, prop_open as prop_id from _fx
    union all select cs_race, sr_race, prop_race from _fx
    union all select cs_guard, sr_guard, prop_guard from _fx
    union all select cs_cancel, sr_cancel, prop_cancel from _fx
  ) x;

  update public.service_requests sr
  set contracted_service_id = x.cs_id
  from (
    select sr_open as sr_id, cs_open as cs_id from _fx
    union all select sr_race, cs_race from _fx
    union all select sr_guard, cs_guard from _fx
    union all select sr_cancel, cs_cancel from _fx
  ) x
  where sr.id = x.sr_id;

  insert into public.chats (
    id, service_request_id, client_id, provider_id, status, last_interaction_at
  )
  select f.chat_open, f.sr_open, f.client_id, f.provider_id,
    'ACTIVE'::public.cns_conversation_status, now()
  from _fx f;

  reset role;

  insert into public.service_request_enrichments (
    id, service_request_id, status, checklist_schema, source, materialized_at
  )
  select x.enr_id, x.sr_id, 'READY'::public.enrichment_status, v_schema,
    'fallback_template'::public.checklist_source, now()
  from (
    select enr_open as enr_id, sr_open as sr_id from _fx
    union all select enr_race, sr_race from _fx
    union all select enr_guard, sr_guard from _fx
    union all select enr_cancel, sr_cancel from _fx
  ) x;

  insert into public.contracted_service_completion_evidence (
    contracted_service_id, enrichment_id, phase, frozen_at, responses_hash,
    responses, idempotency_key
  )
  select
    x.cs_id, x.enr_id,
    'frozen'::public.completion_evidence_phase,
    now() - interval '48 hours',
    'hash',
    '{"crit_work_done":{"met":true,"evidence_paths":["a.jpg"]},
      "crit_area_clean":{"met":true},
      "crit_client_access":{"met":true}}'::jsonb,
    'seed-dispute-' || x.cs_id::text
  from (
    select cs_open as cs_id, enr_open as enr_id from _fx
    union all select cs_race, enr_race from _fx
    union all select cs_guard, enr_guard from _fx
    union all select cs_cancel, enr_cancel from _fx
  ) x;
end;
$seed$;

select pg_temp.rls_seed_user((select admin_id from _fx), 'admin', 'Dispute Admin');

-- ---------------------------------------------------------------------------
-- Auth / actor guards
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_anon();

select throws_ok(
  $$ select public.service_completion_open_dispute((select cs_open from _fx), 'x') $$,
  '42501',
  'Authentication required for service_completion_open_dispute',
  'open_dispute requires authentication'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select throws_ok(
  $$ select public.service_completion_open_dispute((select cs_open from _fx), null) $$,
  'P0003',
  'SERVICE_NOT_FOUND_OR_UNAUTHORIZED',
  'provider cannot open dispute on client CS'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$ select public.service_completion_admin_resolve_dispute((select cs_open from _fx)) $$,
  '42501',
  'Admin or service_role required for service_completion_admin_resolve_dispute',
  'non-admin client cannot resolve dispute'
);

-- ---------------------------------------------------------------------------
-- Happy path: open dispute
-- ---------------------------------------------------------------------------

create temp table _open as
select public.service_completion_open_dispute(
  (select cs_open from _fx),
  'Serviço incompleto'
) as payload;

select ok(
  (select (payload->>'ok')::boolean from _open)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_open
    where cs.status = 'IN_DISPUTE'::public.contracted_service_status
      and cs.disputed_by = f.client_id
      and cs.disputed_at is not null
      and cs.dispute_reason = 'Serviço incompleto'
  ),
  'open_dispute CAS: EXECUTED → IN_DISPUTE with audit columns'
);

select ok(
  exists (
    select 1
    from public.chat_messages m
    join _fx f on m.chat_id = f.chat_open
    where m.message_type = 'SYSTEM'::public.cns_message_type
      and m.payload->>'text' ilike '%disputa%'
  ),
  'open_dispute inserts SYSTEM chat message (chat stays open)'
);

select ok(
  exists (
    select 1
    from public.chats c
    join _fx f on c.id = f.chat_open
    where c.status = 'ACTIVE'::public.cns_conversation_status
  ),
  'open_dispute does not close the chat'
);

select is(
  (select payload->'mmd'->>'template_key' from _open),
  'service.service_dispute_opened',
  'open_dispute MMD routes to service.service_dispute_opened for provider'
);

select throws_ok(
  $$ select public.service_completion_open_dispute((select cs_open from _fx), 'again') $$,
  'P0001',
  'DISPUTE_OPEN',
  're-open while IN_DISPUTE raises DISPUTE_OPEN'
);

-- Confirm-with-rating blocked while disputed
select throws_ok(
  $$
    select public.service_completion_confirm_with_rating(
      (select cs_open from _fx),
      5::smallint, 5::smallint, 5::smallint, 5::smallint,
      null, 'idem-dispute-confirm'
    )
  $$,
  'P0001',
  'DISPUTE_OPEN',
  'confirm_with_rating rejected with DISPUTE_OPEN while IN_DISPUTE'
);

-- Context capabilities while disputed
select ok(
  (
    select
      (ctx->'capabilities'->>'can_confirm_with_rating')::boolean = false
      and (ctx->'capabilities'->>'show_dispute_stub')::boolean = false
      and (ctx->'capabilities'->>'can_open_dispute')::boolean = false
      and (ctx->'capabilities'->>'is_in_dispute')::boolean = true
      and ctx->'contracted_service'->>'status' = 'IN_DISPUTE'
    from public.get_service_completion_context((select sr_open from _fx)) as ctx
  ),
  'completion context exposes dispute flags and disables open/confirm while IN_DISPUTE'
);

-- ---------------------------------------------------------------------------
-- Race: open wins against auto-complete (CAS on EXECUTED)
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

create temp table _race_open as
select public.service_completion_open_dispute(
  (select cs_race from _fx),
  null
) as payload;

select pg_temp.set_service_role();

create temp table _race_auto as
select public.service_completion_auto_complete_executed(50) as payload;

select ok(
  exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_race
    where cs.status = 'IN_DISPUTE'::public.contracted_service_status
      and cs.completed_at is null
  )
  and not exists (
    select 1
    from jsonb_array_elements((_race_auto.payload)->'completed') e
    join _fx f on (e->>'contracted_service_id')::uuid = f.cs_race
  ),
  'auto-complete skips CS already moved to IN_DISPUTE (CAS race)'
)
from _race_auto;

-- Guard: CONFIRMED cannot open dispute
update public.contracted_services cs
set status = 'CONFIRMED'::public.contracted_service_status,
    executed_at = null
from _fx f
where cs.id = f.cs_guard;

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select throws_ok(
  $$ select public.service_completion_open_dispute((select cs_guard from _fx), null) $$,
  'P0001',
  'DISPUTE_NOT_ALLOWED',
  'open_dispute rejected when status is not EXECUTED'
);

-- ---------------------------------------------------------------------------
-- Cancel blocked while IN_DISPUTE
-- ---------------------------------------------------------------------------

update public.contracted_services cs
set
  status = 'IN_DISPUTE'::public.contracted_service_status,
  disputed_at = now(),
  disputed_by = f.client_id,
  dispute_reason = 'cancel-guard'
from _fx f
where cs.id = f.cs_cancel;

select pg_temp.set_service_role();

select throws_ok(
  $$
    select public.payment_prepare_refund_request(
      (select cs_cancel from _fx),
      (select client_id from _fx),
      'CLIENT_INITIATED',
      'client'
    )
  $$,
  'P0001',
  'SERVICE_NOT_CANCELLABLE',
  'payment_prepare_refund_request blocked for IN_DISPUTE'
);

select throws_ok(
  $$
    update public.contracted_services
    set status = 'CANCELLED'::public.contracted_service_status
    where id = (select cs_cancel from _fx)
  $$,
  'P0001',
  'SERVICE_NOT_CANCELLABLE',
  'trigger blocks IN_DISPUTE → CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Admin resolve
-- ---------------------------------------------------------------------------

select pg_temp.rls_set_auth((select admin_id from _fx));

create temp table _resolve as
select public.service_completion_admin_resolve_dispute(
  (select cs_open from _fx)
) as payload;

select ok(
  (select (payload->>'ok')::boolean and not (payload->>'idempotent')::boolean from _resolve)
  and exists (
    select 1
    from public.contracted_services cs
    join _fx f on cs.id = f.cs_open
    where cs.status = 'COMPLETED'::public.contracted_service_status
      and cs.completed_by = 'admin'
      and cs.dispute_resolved_at is not null
  ),
  'admin_resolve_dispute: IN_DISPUTE → COMPLETED completed_by=admin'
);

select is(
  (select payload->'mmd_client'->>'template_key' from _resolve),
  'service.service_dispute_resolved',
  'admin resolve MMD client uses service.service_dispute_resolved'
);

select is(
  (select payload->'mmd_provider'->>'template_key' from _resolve),
  'service.service_dispute_resolved',
  'admin resolve MMD provider uses service.service_dispute_resolved'
);

select ok(
  exists (
    select 1
    from public.chat_messages m
    join _fx f on m.chat_id = f.chat_open
    where m.message_type = 'SYSTEM'::public.cns_message_type
      and m.payload->>'text' ilike '%resolvida%'
  ),
  'admin resolve inserts SYSTEM chat message'
);

-- Idempotent replay
create temp table _resolve2 as
select public.service_completion_admin_resolve_dispute(
  (select cs_open from _fx)
) as payload;

select ok(
  (select (payload->>'idempotent')::boolean from _resolve2),
  'admin_resolve_dispute is idempotent when already COMPLETED by admin'
);

-- Optional rating capability after admin resolve
select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select
      (ctx->'capabilities'->>'can_submit_optional_rating')::boolean = true
      and (ctx->'capabilities'->>'is_in_dispute')::boolean = false
      and (ctx->'capabilities'->>'can_open_dispute')::boolean = false
    from public.get_service_completion_context((select sr_open from _fx)) as ctx
  ),
  'after admin resolve, client can submit optional rating (completed_by=admin)'
);

select * from finish();
rollback;
