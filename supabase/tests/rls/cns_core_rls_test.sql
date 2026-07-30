-- pgTAP: CNS core tables RLS (chats, messages, proposals, contracted_services).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(17);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_a_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.provider_c_id', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('rls.service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(current_setting('rls.provider_c_id')::uuid, 'provider', 'Provider C');
select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'CNS Admin');

create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (service_request_id, client_id, provider_id, status, last_interaction_at)
  values (p_service_request_id, p_client_id, p_provider_id, 'ACTIVE', now())
  on conflict (service_request_id, provider_id) do update
    set status = excluded.status, last_interaction_at = excluded.last_interaction_at, updated_at = now()
  returning id into v_chat_id;
  return v_chat_id;
end;
$$;

create temp table _fixture as
select
  current_setting('rls.service_request_id')::uuid as service_request_id,
  pg_temp.cns_seed_chat(
    current_setting('rls.service_request_id')::uuid,
    current_setting('rls.client_id')::uuid,
    current_setting('rls.provider_a_id')::uuid
  ) as chat_id,
  current_setting('rls.client_id')::uuid as client_id,
  current_setting('rls.provider_a_id')::uuid as provider_a_id,
  current_setting('rls.provider_c_id')::uuid as provider_c_id,
  current_setting('rls.admin_id')::uuid as admin_id;

insert into public.chat_messages (
  chat_id, sender_user_id, message_type, payload, idempotency_key
)
select
  f.chat_id,
  f.provider_a_id,
  'TEXT'::public.cns_message_type,
  '{"text":"cns core rls"}'::jsonb,
  'e2222222-2222-4222-8222-222222222222'::uuid
from _fixture f;

select set_config('rls.chat_id', (select chat_id::text from _fixture), true);

reset role;

select pg_temp.rls_set_auth(current_setting('rls.provider_a_id')::uuid);

create temp table _core_rls_proposal as
with pricing as (
  select * from public.calculate_provider_service_pricing(100.00::numeric)
)
select public.create_provider_proposal(
  current_setting('rls.service_request_id')::uuid,
  gen_random_uuid(),
  pricing.original_amount,
  'RLS core proposal',
  1,
  'hours',
  jsonb_build_array(
    jsonb_build_object(
      'start_date', (current_date + 1)::text,
      'shift', 'morning'
    )
  ),
  '{}'::text[],
  pricing.tax_rate,
  pricing.tax_amount,
  pricing.final_amount,
  pricing.pricing_signature
) as submit_response
from pricing
where not exists (
  select 1
  from public.provider_proposals pp
  where pp.service_request_id = current_setting('rls.service_request_id')::uuid
    and pp.provider_id = current_setting('rls.provider_a_id')::uuid
);

-- Structural: deny policies + SELECT-only grants ------------------------------

select ok(
  has_table_privilege('authenticated', 'public.chats', 'SELECT')
  and not has_table_privilege('authenticated', 'public.chats', 'INSERT'),
  'authenticated SELECT-only on chats'
);

select ok(
  has_table_privilege('authenticated', 'public.chat_messages', 'SELECT')
  and not has_table_privilege('authenticated', 'public.chat_messages', 'INSERT'),
  'authenticated SELECT-only on chat_messages'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_proposals', 'SELECT')
  and not has_table_privilege('authenticated', 'public.provider_proposals', 'INSERT'),
  'authenticated SELECT-only on provider_proposals'
);

-- chats_select ----------------------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) = 1 from public.chats where id = current_setting('rls.chat_id')::uuid),
  'admin reads chat (chats_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (select count(*) = 1 from public.chats where id = current_setting('rls.chat_id')::uuid),
  'client participant reads chat (chats_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (select count(*)::int from public.chats where id = current_setting('rls.chat_id')::uuid),
  0,
  'outsider provider cannot read chat (chats_select deny)'
);

-- chat_messages_select + insert_denied ----------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_a_id')::uuid);

select ok(
  (select count(*) >= 1 from public.chat_messages where chat_id = current_setting('rls.chat_id')::uuid),
  'participant reads messages (chat_messages_select)'
);

select throws_ok(
  format(
    $q$
      insert into public.chat_messages (chat_id, sender_user_id, message_type, payload, idempotency_key)
      values ('%s', '%s', 'TEXT', '{"text":"forged"}', gen_random_uuid())
    $q$,
    current_setting('rls.chat_id'),
    current_setting('rls.provider_a_id')
  ),
  '42501',
  null,
  'direct INSERT denied on chat_messages (chat_messages_insert_denied)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (select count(*)::int from public.chat_messages where chat_id = current_setting('rls.chat_id')::uuid),
  0,
  'outsider cannot read messages (chat_messages_select)'
);

-- provider_proposals_select ---------------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_a_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from public.provider_proposals
    where service_request_id = current_setting('rls.service_request_id')::uuid
      and provider_id = current_setting('rls.provider_a_id')::uuid
  ),
  'owning provider reads proposal (provider_proposals_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select ok(
  (
    select count(*) >= 1
    from public.provider_proposals
    where service_request_id = current_setting('rls.service_request_id')::uuid
  ),
  'client reads proposals on own SR (provider_proposals_select)'
);

select pg_temp.rls_set_auth(current_setting('rls.provider_c_id')::uuid);

select is(
  (
    select count(*)::int
    from public.provider_proposals
    where service_request_id = current_setting('rls.service_request_id')::uuid
      and provider_id = current_setting('rls.provider_a_id')::uuid
  ),
  0,
  'provider C cannot read provider A proposal (provider_proposals_select)'
);

select throws_ok(
  format(
    $q$
      insert into public.provider_proposals (
        provider_id, service_request_id, proposed_amount,
        proposal_description, proposal_duration_value, proposal_duration_unit, status
      ) values (
        '%s', '%s', 50, 'forged', 1, 'hours', 'PENDING'
      )
    $q$,
    current_setting('rls.provider_c_id'),
    current_setting('rls.service_request_id')
  ),
  '42501',
  null,
  'direct INSERT denied on provider_proposals (provider_proposals_insert_denied)'
);

-- contracted_services_select + mutations denied -------------------------------

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (
    select count(*)::int
    from public.contracted_services
    where service_request_id = current_setting('rls.service_request_id')::uuid
  ),
  0,
  'client sees no contracted_service before accept (contracted_services_select)'
);

select throws_ok(
  format(
    $q$
      insert into public.contracted_services (service_request_id, client_id, provider_id, status)
      values ('%s', '%s', '%s', 'PENDING_PAYMENT')
    $q$,
    current_setting('rls.service_request_id'),
    current_setting('rls.client_id'),
    current_setting('rls.provider_a_id')
  ),
  '42501',
  null,
  'direct INSERT denied on contracted_services (contracted_services_insert_denied)'
);

-- chats_insert_denied / update_denied -----------------------------------------

select throws_ok(
  format(
    $q$
      insert into public.chats (service_request_id, client_id, provider_id, status)
      values ('%s', '%s', '%s', 'ACTIVE')
    $q$,
    current_setting('rls.service_request_id'),
    current_setting('rls.client_id'),
    current_setting('rls.provider_c_id')
  ),
  '42501',
  null,
  'direct INSERT denied on chats (chats_insert_denied)'
);

select throws_ok(
  format(
    $$ update public.chats set status = 'CLOSED' where id = '%s' $$,
    current_setting('rls.chat_id')
  ),
  '42501',
  null,
  'direct UPDATE denied on chats (chats_update_denied)'
);

select finish();

rollback;
