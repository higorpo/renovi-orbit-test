-- pgTAP: payment Task 18 — payment_calculate_installment_options RPC.

begin;

select plan(7);

create or replace function pg_temp.payment_set_client_auth(p_user_id uuid)
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
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.payment_set_provider_auth(p_user_id uuid)
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
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select throws_ok(
  $$ select public.payment_calculate_installment_options(
    gen_random_uuid(),
    gen_random_uuid(),
    'MASTER'
  ) $$,
  '42501',
  'Authentication required for payment_calculate_installment_options',
  'rejects unauthenticated callers'
);

select pg_temp.payment_set_client_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $$ select public.payment_calculate_installment_options(
    gen_random_uuid(),
    gen_random_uuid(),
    'MASTER'
  ) $$,
  'P0002',
  'PROPOSAL_NOT_FOUND',
  'rejects proposal not owned by caller'
);

create temp table _installment_sr as
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
  sr_fixture.service_request_id,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  sr.service_id,
  sr.address_id,
  'installment options pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN',
  sr.urgency
from _installment_sr sr_fixture
cross join public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

create temp table _installment_slot as
select jsonb_build_object(
  'start_date', (current_date + 7)::text,
  'end_date', (current_date + 7)::text,
  'shift', 'morning'
) as selected_slot;

select pg_temp.payment_set_provider_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _installment_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(1000.00::numeric)
)
select
  (public.create_provider_proposal(
    (select service_request_id from _installment_sr),
    gen_random_uuid(),
    pricing.original_amount,
    'installment pgTAP proposal',
    1,
    'days',
    jsonb_build_array((select selected_slot from _installment_slot)),
    '{}'::text[],
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature
  )->'proposal'->>'id')::uuid as id,
  (select service_request_id from _installment_sr) as service_request_id
from pricing;

select pg_temp.payment_set_client_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

delete from vault.secrets
where name = 'installment_signing_secret';

select throws_ok(
  format(
    $$ select public.payment_calculate_installment_options(
      %L::uuid,
      %L::uuid,
      'MASTER'
    ) $$,
    (select id from _installment_proposal),
    (select service_request_id from _installment_proposal)
  ),
  'P0001',
  'Installment signing secret is not configured in vault',
  'rejects when vault installment_signing_secret is missing'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_calculate_installment_options'
  ),
  'payment_calculate_installment_options is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname = 'payment_calculate_installment_options'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'EXECUTE granted to authenticated only'
);

select is(
  public.payment_round_half_even(10.005::numeric, 2),
  10.00::numeric,
  'banker rounding rounds 10.005 to even 10.00'
);

select is(
  public.payment_round_half_even(10.015::numeric, 2),
  10.02::numeric,
  'banker rounding rounds 10.015 up to even 10.02'
);

select finish();

rollback;
