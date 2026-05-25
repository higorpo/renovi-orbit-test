-- pgTAP: full cross-product matrix for message_dispatch_status_allowed (design §4.8, task 11).
-- Run: supabase test db (or pg_prove) after migrations 20260621100000–20260621100100 are applied.

begin;

select plan(64);

with statuses as (
  select unnest(enum_range(null::message_dispatcher.message_dispatch_status)) as s
),
pairs as (
  select f.s as from_status, t.s as to_status
  from statuses f
  cross join statuses t
),
allowed as (
  select *
  from (
    values
      ('PENDING_EVALUATION'::message_dispatcher.message_dispatch_status, 'SCHEDULED'::message_dispatcher.message_dispatch_status),
      ('PENDING_EVALUATION', 'QUEUED'),
      ('PENDING_EVALUATION', 'CANCELED'),
      ('PENDING_EVALUATION', 'FAILED_TERMINAL'),
      ('SCHEDULED', 'PENDING_EVALUATION'),
      ('SCHEDULED', 'QUEUED'),
      ('SCHEDULED', 'CANCELED'),
      ('SCHEDULED', 'FAILED_TERMINAL'),
      ('QUEUED', 'PROCESSING'),
      ('QUEUED', 'CANCELED'),
      ('QUEUED', 'FAILED_TERMINAL'),
      ('PROCESSING', 'QUEUED'),
      ('PROCESSING', 'DELIVERED'),
      ('PROCESSING', 'FAILED_RETRYABLE'),
      ('PROCESSING', 'FAILED_TERMINAL'),
      ('FAILED_RETRYABLE', 'QUEUED'),
      ('FAILED_RETRYABLE', 'CANCELED'),
      ('FAILED_RETRYABLE', 'FAILED_TERMINAL')
  ) as v (from_status, to_status)
),
expected as (
  select
    p.from_status,
    p.to_status,
    exists (
      select 1
      from allowed a
      where a.from_status = p.from_status
        and a.to_status = p.to_status
    ) as should_allow
  from pairs p
)
select ok(
  message_dispatcher.message_dispatch_status_allowed(e.from_status, e.to_status) = e.should_allow,
  format('%s -> %s (expected %s)', e.from_status, e.to_status, e.should_allow)
)
from expected e;

select finish();

rollback;
