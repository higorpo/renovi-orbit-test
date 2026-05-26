-- pgTAP: engagement dedup — same dispatch+type upserts correctly (duplicate webhook tolerance).

begin;

select plan(4);

create temp table _fixture as
select p.id as profile_id, gen_random_uuid() as dispatch_id
from public.profiles p
limit 1;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for,
  vendor_message_id
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'DELIVERED'::message_dispatcher.message_dispatch_status,
  now(),
  're_dedup_test_1'
from _fixture f;

-- First open
select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{"first": true}'::jsonb
);

-- Record first_seen_at
create temp table _first_seen as
select first_seen_at, last_seen_at
from message_dispatcher.message_dispatch_engagements e
join _fixture f on e.dispatch_id = f.dispatch_id
where e.engagement_type = 'opened';

-- Wait a tiny bit for clock advancement, then second open
select pg_sleep(0.01);

select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{"second": true}'::jsonb
);

-- Third open
select pg_sleep(0.01);

select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{"third": true}'::jsonb
);

-- Verify only one row exists (dedup by unique constraint)
select is(
  (
    select count(*)::text
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  '1',
  'only one engagement row exists despite three calls'
);

-- Verify seen_count = 3
select is(
  (
    select seen_count::text
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  '3',
  'seen_count is 3 after three upserts'
);

-- Verify first_seen_at is unchanged
select is(
  (
    select e.first_seen_at::text
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  (select first_seen_at::text from _first_seen),
  'first_seen_at unchanged after subsequent upserts'
);

-- Verify last_seen_at is >= first_seen_at (equal within single tx because now() is constant)
select ok(
  (
    select e.last_seen_at >= fs.first_seen_at
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    cross join _first_seen fs
    where e.engagement_type = 'opened'
  ),
  'last_seen_at >= first_seen_at after upserts'
);

select finish();

rollback;
