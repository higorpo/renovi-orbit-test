-- pgTAP: create_provider_proposal unified RPC (service_request scoped, optional chat mirror).

begin;

\ir fixtures/seed_chat.inc

select plan(7);

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

create or replace function pg_temp.cns_seed_delegate_sr()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
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
    urgency
  )
  select
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'create_provider_proposal pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_provider_proposal'
  ),
  'create_provider_proposal is SECURITY DEFINER'
);

create temp table _delegate_sr as
select pg_temp.cns_seed_delegate_sr() as service_request_id;

create temp table _delegate_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _delegate_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _delegate_result as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(250.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _delegate_sr),
  pricing.original_amount,
  'Unified create scope includes wiring',
  2,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 2)::text,
      'shift', 'morning'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as response
from pricing;

select is(
  jsonb_typeof((select response from _delegate_result)),
  'object',
  'create returns json object'
);

select ok(
  (select response ? 'id' from _delegate_result),
  'create preserves legacy { id } response shape'
);

select is(
  (
    select pp.status::text
    from public.provider_proposals pp
    where pp.id = ((select response->>'id' from _delegate_result))::uuid
  ),
  'PENDING',
  'create inserts PENDING proposal by service_request_id'
);

select ok(
  (
    select exists (
      select 1
      from public.chat_messages m
      where m.chat_id = (select chat_id from _delegate_chat)
        and m.message_type = 'PROPOSAL'::public.cns_message_type
        and m.linked_entity_id = (
          (select response->>'id' from _delegate_result)
        )::uuid
    )
  ),
  'create mirrors PROPOSAL timeline message when chat exists'
);

select throws_ok(
  $sql$
    with pricing as (
      select *
      from public.calculate_provider_service_pricing(250.00::numeric)
    )
    select public.create_provider_proposal(
      (select service_request_id from _delegate_sr),
      pricing.original_amount,
      'Duplicate pending attempt',
      2,
      'hours',
      jsonb_build_array(
        jsonb_build_object(
          'start_date', (current_date + 3)::text,
          'shift', 'afternoon'
        )
      ),
      '{}'::text[],
      pricing.tax_rate,
      pricing.tax_amount,
      pricing.final_amount,
      pricing.pricing_signature
    )
    from pricing;
  $sql$,
  'P0001',
  'PROPOSAL_ALREADY_PENDING',
  'second PENDING create is rejected'
);

create temp table _delegate_no_chat_sr as
select pg_temp.cns_seed_delegate_sr() as service_request_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _delegate_no_chat_result as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(180.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _delegate_no_chat_sr),
  pricing.original_amount,
  'Proposal without pre-existing chat',
  1,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 1)::text,
      'shift', 'afternoon'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as response
from pricing;

select ok(
  not exists (
    select 1
    from public.chats c
    where c.service_request_id = (select service_request_id from _delegate_no_chat_sr)
      and c.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'create does not auto-initiate chat when missing'
);

select ok(
  (
    select jsonb_typeof(response->'timeline_message') = 'null'
    from _delegate_no_chat_result
  ),
  'create skips timeline mirror when chat is absent'
);

select * from finish();
rollback;
