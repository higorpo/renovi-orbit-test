-- pgTAP: accept flow with PostgREST-style auth (request.jwt.claims only).
-- Regression: _cns_apply_service_reschedule_slot used to overwrite request.jwt.claims
-- without restoring, so auth.uid() became null and idempotency_commit failed.

begin;

create or replace function pg_temp.cns_set_postgrest_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  -- Mirror PostgREST: only request.jwt.claims, no legacy request.jwt.claim.* GUCs.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

select plan(7);

do $seed$
declare
  v_service_id uuid := gen_random_uuid();
  v_sr_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_pricing record;
  v_slot jsonb;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description, form_data, form_version, status, urgency
  )
  select
    v_sr_id, sr.client_id, sr.service_id, sr.address_id,
    format('service reschedule postgrest claims %s', v_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform pg_temp.cns_set_postgrest_auth(v_provider_id);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 10, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    selected_slot, photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_sr_id, v_pricing.original_amount,
    'service reschedule postgrest claims proposal', 1, 'days', jsonb_build_array(v_slot),
    v_slot,
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_end_date,
    scheduled_shift, agreed_slot, status
  )
  values (
    v_service_id, v_sr_id, v_proposal_id, v_client_id, v_provider_id,
    'days', 1, current_date + 10, current_date + 10, 'morning', v_slot,
    'CONFIRMED'::public.contracted_service_status
  );

  insert into public.chats (
    service_request_id, client_id, provider_id, status, last_interaction_at
  )
  values (v_sr_id, v_client_id, v_provider_id, 'ACTIVE', now())
  on conflict (service_request_id, provider_id) do update
    set status = excluded.status, last_interaction_at = excluded.last_interaction_at;

  perform set_config('test.pgrst_service_id', v_service_id::text, true);
  perform set_config('test.pgrst_client_id', v_client_id::text, true);
  perform set_config('test.pgrst_provider_id', v_provider_id::text, true);
end;
$seed$;

select pg_temp.cns_set_postgrest_auth(current_setting('test.pgrst_client_id')::uuid);

create temp table _pgrst_request as
select public.cns_request_service_reschedule(
  current_setting('test.pgrst_service_id')::uuid,
  gen_random_uuid(),
  null
) as response;

select pg_temp.cns_set_postgrest_auth(current_setting('test.pgrst_provider_id')::uuid);

create temp table _pgrst_propose as
select public.cns_propose_service_reschedule(
  (select (response->>'reschedule_request_id')::uuid from _pgrst_request),
  jsonb_build_object(
    'start_date', to_char(current_date + 12, 'YYYY-MM-DD'),
    'end_date', to_char(current_date + 12, 'YYYY-MM-DD'),
    'shift', 'afternoon'
  ),
  gen_random_uuid()
) as response;

select pg_temp.cns_set_postgrest_auth(current_setting('test.pgrst_client_id')::uuid);

select lives_ok(
  format(
    $$ select public.cns_accept_service_reschedule(%L::uuid, gen_random_uuid()) $$,
    (select response->>'reschedule_request_id' from _pgrst_request)
  ),
  'accept succeeds with PostgREST-style claims (idempotency_commit keeps actor)'
);

select is(
  (
    select srr.status::text
    from public.service_reschedule_requests srr
    where srr.id = (select (response->>'reschedule_request_id')::uuid from _pgrst_request)
  ),
  'ACCEPTED',
  'request row transitions to ACCEPTED'
);

select is(
  (
    select cs.scheduled_shift
    from public.contracted_services cs
    where cs.id = current_setting('test.pgrst_service_id')::uuid
  ),
  'afternoon',
  'accept applies proposed slot to contracted service'
);

select is(
  auth.uid()::text,
  current_setting('test.pgrst_client_id'),
  'actor claims are restored after accept flow'
);

select is(
  (
    select public.get_conversation_detail(
      (select (response->>'chat_id')::uuid from _pgrst_request)
    )->'accepted_proposal'->'selected_slot'->>'shift'
  ),
  'afternoon',
  'chat details accepted proposal shows rescheduled slot'
);

select is(
  (
    select public.get_proposal_detail_for_participant(
      (
        select cs.accepted_proposal_id
        from public.contracted_services cs
        where cs.id = current_setting('test.pgrst_service_id')::uuid
      )
    )->'selected_slot'->>'shift'
  ),
  'afternoon',
  'timeline proposal hydration shows rescheduled slot'
);

select is(
  (
    select pp.selected_slot->>'shift'
    from public.provider_proposals pp
    where pp.id = (
      select cs.accepted_proposal_id
      from public.contracted_services cs
      where cs.id = current_setting('test.pgrst_service_id')::uuid
    )
  ),
  'morning',
  'proposal selected_slot remains initial accept snapshot'
);

select finish();

rollback;
