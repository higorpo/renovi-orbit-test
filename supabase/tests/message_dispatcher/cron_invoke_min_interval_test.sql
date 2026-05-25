-- pgTAP: worker invoke minimum interval (design §1.6, task 108).

begin;

select plan(6);

select is(
  message_dispatcher.message_dispatcher_worker_invoke_min_interval_seconds(),
  15,
  'worker_invoke_min_interval_seconds floor is 15'
);

update public.platform_constants
set value = to_jsonb(now()::text), updated_at = now()
where key = 'message_dispatcher.last_worker_invoke_at';

select ok(
  message_dispatcher.message_dispatcher_try_claim_worker_invoke() = false,
  'try_claim returns false inside min interval'
);

update public.platform_constants
set value = to_jsonb((now() - interval '20 seconds')::text), updated_at = now()
where key = 'message_dispatcher.last_worker_invoke_at';

select ok(
  message_dispatcher.message_dispatcher_try_claim_worker_invoke(),
  'try_claim succeeds after min interval elapsed'
);

update public.platform_constants
set value = to_jsonb('https://example.test/worker'::text), updated_at = now()
where key = 'message_dispatcher.worker_url';

update public.platform_constants
set value = to_jsonb('test-cron-secret'::text), updated_at = now()
where key = 'message_dispatcher.cron_secret';

update public.platform_constants
set value = to_jsonb((now() - interval '20 seconds')::text), updated_at = now()
where key = 'message_dispatcher.last_worker_invoke_at';

select lives_ok(
  $$select message_dispatcher.message_dispatcher_invoke_worker()$$,
  'invoke_worker runs when claim allowed'
);

create temp table _mmd_invoke_ts as
select (pc.value #>> '{}')::timestamptz as claimed_at
from public.platform_constants pc
where pc.key = 'message_dispatcher.last_worker_invoke_at';

select lives_ok(
  $$select message_dispatcher.message_dispatcher_invoke_worker()$$,
  'second invoke_worker within interval is throttled (no error)'
);

select is(
  (select claimed_at from _mmd_invoke_ts),
  (
    select (pc.value #>> '{}')::timestamptz
    from public.platform_constants pc
    where pc.key = 'message_dispatcher.last_worker_invoke_at'
  ),
  'throttled second invoke does not advance last_worker_invoke_at'
);

select finish();

rollback;
