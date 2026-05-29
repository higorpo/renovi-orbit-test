-- pgTAP: cns_has_bilateral_reciprocity (CNS task 27, design §4.6).

begin;

\ir fixtures/seed_chat.inc
\ir fixtures/seed_reciprocity_messages.inc

select plan(8);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_has_bilateral_reciprocity'
  ),
  'cns_has_bilateral_reciprocity is SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cns_has_bilateral_reciprocity(uuid,int)',
    'EXECUTE'
  ),
  'authenticated cannot execute cns_has_bilateral_reciprocity'
);

create or replace function pg_temp.cns_seed_isolated_chat()
returns table (
  chat_id uuid,
  client_id uuid,
  provider_id uuid
)
language plpgsql
as $$
declare
  v_sr_id uuid;
  v_client_id uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
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
    'Reciprocity pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN',
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  chat_id := pg_temp.cns_seed_chat(
    p_service_request_id := v_sr_id,
    p_client_id := v_client_id,
    p_provider_id := v_provider_id
  );
  client_id := v_client_id;
  provider_id := v_provider_id;

  return next;
end;
$$;

create temp table _empty_chat as
select * from pg_temp.cns_seed_isolated_chat();

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _empty_chat),
    24
  ),
  false,
  'empty history is not bilateral'
);

create temp table _client_only_chat as
select * from pg_temp.cns_seed_isolated_chat();

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _client_only_chat),
  (select client_id from _client_only_chat),
  'TEXT'::public.cns_message_type
);

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _client_only_chat),
    24
  ),
  false,
  'client-only TEXT is unilateral'
);

create temp table _bilateral_chat as
select * from pg_temp.cns_seed_isolated_chat();

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _bilateral_chat),
  (select client_id from _bilateral_chat),
  'TEXT'::public.cns_message_type
);

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _bilateral_chat),
  (select provider_id from _bilateral_chat),
  'PROPOSAL'::public.cns_message_type
);

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _bilateral_chat),
    24
  ),
  true,
  'client TEXT plus provider PROPOSAL is bilateral'
);

create temp table _provider_only_chat as
select * from pg_temp.cns_seed_isolated_chat();

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _provider_only_chat),
  (select provider_id from _provider_only_chat),
  'TEXT'::public.cns_message_type
);

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _provider_only_chat),
    24
  ),
  false,
  'provider-only TEXT is unilateral'
);

create temp table _system_only_chat as
select * from pg_temp.cns_seed_isolated_chat();

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _system_only_chat),
  null,
  'SYSTEM'::public.cns_message_type
);

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _system_only_chat),
    24
  ),
  false,
  'SYSTEM messages do not count toward reciprocity'
);

create temp table _stale_chat as
select * from pg_temp.cns_seed_isolated_chat();

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _stale_chat),
  (select client_id from _stale_chat),
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select pg_temp.cns_seed_reciprocity_message(
  (select chat_id from _stale_chat),
  (select provider_id from _stale_chat),
  'TEXT'::public.cns_message_type,
  now() - interval '25 hours'
);

select is(
  public.cns_has_bilateral_reciprocity(
    (select chat_id from _stale_chat),
    24
  ),
  false,
  'bilateral messages outside 24h window are stale'
);

select finish();

rollback;
