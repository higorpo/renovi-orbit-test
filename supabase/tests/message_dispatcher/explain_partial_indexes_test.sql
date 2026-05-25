-- pgTAP: partial indexes for scheduled_due, retry_due, and stale_lease exist and are valid (design §3.3.2).

begin;

select plan(9);

-- scheduled_due_idx
select has_index(
  'message_dispatcher',
  'message_dispatches',
  'message_dispatches_scheduled_due_idx',
  array['scheduled_for']
);

select ok(
  (
    select i.indisvalid
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'message_dispatcher'
      and t.relname = 'message_dispatches'
      and ix.relname = 'message_dispatches_scheduled_due_idx'
  ),
  'scheduled_due_idx is valid'
);

-- retry_due_idx
select has_index(
  'message_dispatcher',
  'message_dispatches',
  'message_dispatches_retry_due_idx',
  array['next_retry_at']
);

select ok(
  (
    select i.indisvalid
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'message_dispatcher'
      and t.relname = 'message_dispatches'
      and ix.relname = 'message_dispatches_retry_due_idx'
  ),
  'retry_due_idx is valid'
);

-- stale_lease_idx
select has_index(
  'message_dispatcher',
  'message_dispatches',
  'message_dispatches_stale_lease_idx',
  array['locked_until']
);

select ok(
  (
    select i.indisvalid
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'message_dispatcher'
      and t.relname = 'message_dispatches'
      and ix.relname = 'message_dispatches_stale_lease_idx'
  ),
  'stale_lease_idx is valid'
);

-- EXPLAIN: activate_scheduled query uses scheduled_due_idx
insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, scheduled_for
)
select
  gen_random_uuid(), p.id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  now() - (g * interval '1 second')
from public.profiles p,
  generate_series(1, 5) g
limit 5;

create or replace function _mmd_test_explain_uses_scheduled_due_idx()
returns boolean
language plpgsql
set search_path = message_dispatcher, public
as $$
declare
  r record;
  found_idx boolean := false;
begin
  set local enable_seqscan = off;

  for r in
    explain (analyze false, format text)
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'SCHEDULED'
      and d.scheduled_for <= now()
    order by d.scheduled_for
    limit 500
  loop
    if position('message_dispatches_scheduled_due_idx' in r."QUERY PLAN") > 0 then
      found_idx := true;
      exit;
    end if;
  end loop;

  return found_idx;
end;
$$;

select ok(
  _mmd_test_explain_uses_scheduled_due_idx(),
  'EXPLAIN shows scheduled_due_idx for activate_scheduled query'
);

drop function _mmd_test_explain_uses_scheduled_due_idx();

-- EXPLAIN: promote_retries query uses retry_due_idx
delete from message_dispatcher.message_dispatches
where status = 'SCHEDULED';

insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status, next_retry_at, retry_count
)
select
  gen_random_uuid(), p.id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status,
  now() - (g * interval '1 second'),
  1
from public.profiles p,
  generate_series(1, 5) g
limit 5;

create or replace function _mmd_test_explain_uses_retry_due_idx()
returns boolean
language plpgsql
set search_path = message_dispatcher, public
as $$
declare
  r record;
  found_idx boolean := false;
begin
  set local enable_seqscan = off;

  for r in
    explain (analyze false, format text)
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'FAILED_RETRYABLE'
      and d.next_retry_at is not null
      and d.next_retry_at <= now()
    order by d.next_retry_at, d.created_at
    limit 500
  loop
    if position('message_dispatches_retry_due_idx' in r."QUERY PLAN") > 0 then
      found_idx := true;
      exit;
    end if;
  end loop;

  return found_idx;
end;
$$;

select ok(
  _mmd_test_explain_uses_retry_due_idx(),
  'EXPLAIN shows retry_due_idx for promote_retries query'
);

drop function _mmd_test_explain_uses_retry_due_idx();

-- EXPLAIN: reclaim_leases query uses stale_lease_idx
delete from message_dispatcher.message_dispatches
where status = 'FAILED_RETRYABLE';

insert into message_dispatcher.message_dispatches (
  idempotency_key, profile_id, channel, template_key, status,
  locked_until, locked_by
)
select
  gen_random_uuid(), p.id,
  'email'::message_dispatcher.message_channel, 'welcome_template',
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  now() - (g * interval '1 second'),
  'worker-stale'
from public.profiles p,
  generate_series(1, 5) g
limit 5;

create or replace function _mmd_test_explain_uses_stale_lease_idx()
returns boolean
language plpgsql
set search_path = message_dispatcher, public
as $$
declare
  r record;
  found_idx boolean := false;
begin
  set local enable_seqscan = off;

  for r in
    explain (analyze false, format text)
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'PROCESSING'
      and d.locked_until is not null
      and d.locked_until < now()
    order by d.locked_until, d.created_at
    limit 500
  loop
    if position('message_dispatches_stale_lease_idx' in r."QUERY PLAN") > 0 then
      found_idx := true;
      exit;
    end if;
  end loop;

  return found_idx;
end;
$$;

select ok(
  _mmd_test_explain_uses_stale_lease_idx(),
  'EXPLAIN shows stale_lease_idx for reclaim_leases query'
);

drop function _mmd_test_explain_uses_stale_lease_idx();

select finish();

rollback;
