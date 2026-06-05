-- pgTAP: cns_prune_chat_rate_limit_buckets and pg_cron job.

begin;

\ir fixtures/seed_chat.inc

select plan(10);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_prune_chat_rate_limit_buckets'
  ),
  'cns_prune_chat_rate_limit_buckets is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_prune_chat_rate_limit_buckets(int, int)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cns_prune_chat_rate_limit_buckets(int, int)',
    'EXECUTE'
  ),
  'service_role only may execute prune batch RPC'
);

create temp table _prune_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id;

insert into public.chat_rate_limit_buckets (
  chat_id,
  user_id,
  window_started_at,
  message_count
)
select
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  timestamptz '2000-01-01 00:00:00+00',
  3
from _prune_fixture f
on conflict (chat_id, user_id, window_started_at) do update
  set message_count = excluded.message_count;

insert into public.chat_rate_limit_buckets (
  chat_id,
  user_id,
  window_started_at,
  message_count
)
select
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  timestamptz '2099-01-01 00:00:00+00',
  1
from _prune_fixture f
on conflict (chat_id, user_id, window_started_at) do update
  set message_count = excluded.message_count;

select ok(
  (
    select count(*) = 2
    from public.chat_rate_limit_buckets b
    join _prune_fixture f on f.chat_id = b.chat_id
    where b.window_started_at in (
      timestamptz '2000-01-01 00:00:00+00',
      timestamptz '2099-01-01 00:00:00+00'
    )
  ),
  'fixture inserts old and recent buckets before prune'
);

select ok(
  (
    select (public.cns_prune_chat_rate_limit_buckets(24, 10000)->>'deleted_count')::int >= 1
  ),
  'prune deletes at least one expired bucket'
);

select ok(
  (
    select not exists (
      select 1
      from public.chat_rate_limit_buckets b
      join _prune_fixture f on f.chat_id = b.chat_id
      where b.window_started_at = timestamptz '2000-01-01 00:00:00+00'
    )
  ),
  'old fixture bucket is removed'
);

select ok(
  (
    select exists (
      select 1
      from public.chat_rate_limit_buckets b
      join _prune_fixture f on f.chat_id = b.chat_id
      where b.window_started_at = timestamptz '2099-01-01 00:00:00+00'
    )
  ),
  'recent fixture bucket remains after prune'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cron_cns_prune_chat_rate_limit_buckets'
  ),
  'cron_cns_prune_chat_rate_limit_buckets is SECURITY DEFINER'
);

select ok(
  has_function_privilege(
    'postgres',
    'public.cron_cns_prune_chat_rate_limit_buckets()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cron_cns_prune_chat_rate_limit_buckets()',
    'EXECUTE'
  ),
  'postgres only may execute prune cron wrapper'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_prune_chat_rate_limit_buckets'
      and j.schedule = '0 4 * * *'
      and j.command like '%cron_cns_prune_chat_rate_limit_buckets%'
  ),
  'cns_prune_chat_rate_limit_buckets cron job exists'
);

select ok(
  exists (
    select 1
    from cron.job j
    where j.jobname = 'cns_prune_chat_rate_limit_buckets'
      and j.active = true
  ),
  'cns_prune_chat_rate_limit_buckets cron job is active'
);

select finish();

rollback;
