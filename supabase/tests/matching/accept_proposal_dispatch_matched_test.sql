-- pgTAP: accept_proposal DISPATCH_MATCHED terminal (matching M14c).

begin;

select plan(3);

\ir ../chats/fixtures/seed_chat.inc
\ir ../fixtures/accept_proposal_payment_helpers.inc

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

create temp table _accept_match_sr as
select gen_random_uuid() as service_request_id;

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
  (select service_request_id from _accept_match_sr),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'accept dispatch matched pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values
  (
    (select service_request_id from _accept_match_sr),
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    'batch',
    now()
  ),
  (
    (select service_request_id from _accept_match_sr),
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
    'batch',
    now()
  );

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
values ('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid)
on conflict (profile_id) do nothing;

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  status
)
values (
  gen_random_uuid(),
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  'push'::message_dispatcher.message_channel,
  'matching.new_opportunity',
  jsonb_build_object(
    'service_request_id', (select service_request_id from _accept_match_sr),
    'title', 'Accept matched test',
    'service_name', 'Eletricista',
    'neighborhood', 'Centro',
    'urgency', 'medium',
    'deep_link_path', format('/dashboard/services/%s', (select service_request_id from _accept_match_sr))
  ),
  'QUEUED'::message_dispatcher.message_dispatch_status
);

select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_match_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
);

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_match_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

create temp table _accept_match_submit as
with pricing as (
  select * from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _accept_match_sr),
  gen_random_uuid(),
  pricing.original_amount,
  'Accept matched fixture',
  2,
  'hours',
  jsonb_build_array((select selected_slot from _accept_match_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select pg_temp.cns_accept_proposal_with_payment(
  (select (submit_response->'proposal'->>'id')::uuid from _accept_match_submit),
  (select selected_slot from _accept_match_slot),
  gen_random_uuid()
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _accept_match_sr)
  ),
  'DISPATCH_MATCHED',
  'accept_proposal sets dispatch status to DISPATCH_MATCHED'
);

select ok(
  (
    select v.revoked_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _accept_match_sr)
      and v.provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid
  ),
  'non-winning provider visibility is revoked on accept'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches md
    where md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id from _accept_match_sr)::text
      and md.status = 'CANCELED'::message_dispatcher.message_dispatch_status
  ),
  1,
  'accept_proposal cancels pending matching MMD rows'
);

select finish();

rollback;
