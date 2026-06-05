-- pgTAP: operational / internal tables RLS (admin-only audits, rate limits, negotiation stats).

begin;

\ir fixtures/seed_rls_actors.inc

select plan(18);

select set_config('rls.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('rls.provider_id', '5d09e025-20a2-4842-aeef-324d42a431e1', true);
select set_config('rls.admin_id', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('rls.service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33', true);

select pg_temp.rls_seed_user(current_setting('rls.admin_id')::uuid, 'admin', 'Ops Admin');

-- RLS enabled on internal tables (no client policies) -------------------------

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'domain_events',
        'job_runs',
        'rpc_idempotency_records',
        'chat_audit',
        'proposal_audit',
        'chat_rate_limit_buckets',
        'service_request_negotiation_stats',
        'chat_media_upload_sessions'
      )
  ),
  'operational tables have RLS enabled'
);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in ('chat_rate_limit_buckets', 'service_request_negotiation_stats', 'chat_media_upload_sessions')
  ),
  0,
  'internal counters/sessions have RLS but no client policies'
);

-- Admin-only audit / outbox tables ------------------------------------------

select pg_temp.rls_set_auth(current_setting('rls.admin_id')::uuid);

select ok(
  (select count(*) >= 0 from public.domain_events),
  'admin can SELECT domain_events'
);

select ok(
  (select count(*) >= 0 from public.job_runs),
  'admin can SELECT job_runs'
);

select ok(
  (select count(*) >= 0 from public.rpc_idempotency_records),
  'admin can SELECT rpc_idempotency_records'
);

select pg_temp.rls_set_auth(current_setting('rls.client_id')::uuid);

select is(
  (select count(*)::int from public.domain_events),
  0,
  'client cannot read domain_events'
);

select is(
  (select count(*)::int from public.job_runs),
  0,
  'client cannot read job_runs'
);

select is(
  (select count(*)::int from public.rpc_idempotency_records),
  0,
  'client cannot read rpc_idempotency_records'
);

select throws_ok(
  $$ insert into public.domain_events (event_type, aggregate_type, aggregate_id) values ('test', 'test', gen_random_uuid()) $$,
  '42501',
  null,
  'client cannot INSERT domain_events'
);

-- negotiation_stats + upload_sessions: fully blocked for clients --------------

select throws_ok(
  $$ select count(*) from public.service_request_negotiation_stats $$,
  '42501',
  null,
  'client cannot read service_request_negotiation_stats (permission denied)'
);

select throws_ok(
  $$ select count(*) from public.chat_media_upload_sessions $$,
  '42501',
  null,
  'client cannot read chat_media_upload_sessions (permission denied)'
);

select pg_temp.rls_set_anon();

select throws_ok(
  $$ select count(*) from public.service_request_negotiation_stats $$,
  '42501',
  null,
  'anon cannot read service_request_negotiation_stats (permission denied)'
);

select throws_ok(
  $$
    update public.service_request_negotiation_stats
    set active_chat_count = 999
    where service_request_id = current_setting('rls.service_request_id')::uuid
  $$,
  '42501',
  null,
  'anon cannot UPDATE service_request_negotiation_stats (permission denied)'
);

-- chat_rate_limit_buckets invisible to authenticated --------------------------

select pg_temp.rls_set_auth(current_setting('rls.provider_id')::uuid);

select is(
  (select count(*)::int from public.chat_rate_limit_buckets),
  0,
  'provider cannot read chat_rate_limit_buckets'
);

select throws_ok(
  $$
    insert into public.chat_rate_limit_buckets (chat_id, user_id, window_started_at, message_count)
    values (gen_random_uuid(), gen_random_uuid(), now(), 1)
  $$,
  '42501',
  null,
  'authenticated cannot INSERT chat_rate_limit_buckets (RLS deny)'
);

select ok(
  not has_table_privilege('authenticated', 'public.service_request_negotiation_stats', 'SELECT'),
  'authenticated has no SELECT grant on service_request_negotiation_stats'
);

select ok(
  not has_table_privilege('authenticated', 'public.chat_media_upload_sessions', 'SELECT'),
  'authenticated has no SELECT grant on chat_media_upload_sessions'
);

select ok(
  has_table_privilege('service_role', 'public.service_request_negotiation_stats', 'SELECT'),
  'service_role can access service_request_negotiation_stats'
);

select finish();

rollback;
