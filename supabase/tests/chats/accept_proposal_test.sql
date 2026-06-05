-- pgTAP: accept_proposal happy path (CNS task 31, design §4.4).

begin;

\ir fixtures/seed_chat.inc

select plan(9);

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

create or replace function pg_temp.cns_seed_accept_sr()
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
    'accept_proposal pgTAP fixture',
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
      and p.proname = 'accept_proposal'
  ),
  'accept_proposal is SECURITY DEFINER'
);

create temp table _accept_sr as
select pg_temp.cns_seed_accept_sr() as service_request_id;

create temp table _accept_chat as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

create or replace function pg_temp.cns_seed_provider_user(
  p_user_id uuid,
  p_name text default 'Accept test provider'
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_user_id::text || '@accept-test.local',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('full_name', p_name, 'role', 'provider')::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_user_id,
    json_build_object(
      'sub',
      p_user_id::text,
      'email',
      p_user_id::text || '@accept-test.local'
    )::jsonb,
    'email',
    p_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do nothing;
end;
$$;

select pg_temp.cns_seed_provider_user(
  'b1111111-1111-4111-8111-111111111111'::uuid,
  'Accept competitor provider'
);

create temp table _accept_chat_competitor as
select pg_temp.cns_seed_chat(
  p_service_request_id := (select service_request_id from _accept_sr),
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := 'b1111111-1111-4111-8111-111111111111'::uuid
) as chat_id;

select pg_temp.cns_set_auth('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid);

create temp table _accept_slot as
select jsonb_build_object(
  'start_date', (current_date + 2)::text,
  'shift', 'morning'
) as selected_slot;

create temp table _accept_submit as
with pricing as (
  select *
  from public.calculate_provider_service_pricing(400.00::numeric)
)
select public.create_provider_proposal(
  (select service_request_id from _accept_sr),
  pricing.original_amount,
  'Accept cascade test proposal',
  2,
  'hours',
  jsonb_build_array((select selected_slot from _accept_slot)),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing;

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

create temp table _accept_result as
select public.accept_proposal(
  (select (submit_response->'proposal'->>'id')::uuid from _accept_submit),
  (select selected_slot from _accept_slot),
  'f2222222-2222-4222-8222-222222222222'::uuid
) as response;

select is(
  (select response->'proposal'->>'status' from _accept_result),
  'ACCEPTED',
  'accept sets proposal status to ACCEPTED'
);

select is(
  (
    select status::text
    from public.service_requests
    where id = (select service_request_id from _accept_sr)
  ),
  'COMPLETED',
  'accept sets service request status to COMPLETED'
);

select ok(
  (
    select contracted_service_id is not null
      and completed_at is not null
    from public.service_requests
    where id = (select service_request_id from _accept_sr)
  ),
  'accept links contracted_service_id and sets completed_at'
);

select ok(
  (
    select exists (
      select 1
      from public.contracted_services s
      where s.id = (select (response->'service'->>'id')::uuid from _accept_result)
        and s.status = 'PENDING_PAYMENT'::public.contracted_service_status
    )
  ),
  'accept inserts contracted services row'
);

select is(
  (
    select c.status::text
    from public.chats c
    where c.id = (select chat_id from _accept_chat)
  ),
  'ACTIVE',
  'accept keeps the accepted provider chat open'
);

select is(
  (
    select c.status::text
    from public.chats c
    where c.id = (select chat_id from _accept_chat_competitor)
  ),
  'CLOSED',
  'accept closes competing provider chats only'
);

select lives_ok(
  $sql$
    select public.cns_send_message(
      'TEXT'::public.cns_message_type,
      'f2222222-2222-4222-8222-222222222223'::uuid,
      jsonb_build_object('text', 'Post-accept coordination'),
      (select chat_id from _accept_chat)
    );
  $sql$,
  'accepted provider chat allows cns_send_message after SR completed'
);

select ok(
  (
    select exists (
      select 1
      from public.domain_events de
      where de.event_type = 'PROPOSAL_ACCEPTED'
        and de.aggregate_id = (
          select (submit_response->'proposal'->>'id')::uuid from _accept_submit
        )
    )
    and exists (
      select 1
      from public.domain_events de
      where de.event_type = 'SERVICE_REQUEST_COMPLETED'
        and de.service_request_id = (select service_request_id from _accept_sr)
    )
    and exists (
      select 1
      from public.domain_events de
      where de.event_type = 'CHATS_CLOSED_BULK'
        and de.service_request_id = (select service_request_id from _accept_sr)
    )
  ),
  'accept emits PROPOSAL_ACCEPTED, SERVICE_REQUEST_COMPLETED, and CHATS_CLOSED_BULK'
);

select finish();

rollback;
