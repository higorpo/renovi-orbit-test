-- pgTAP: record_engagement upsert — first insert creates, repeat increments seen_count.

begin;

select plan(6);

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
  're_eng_upsert_1'
from _fixture f;

-- First call should insert; capture result in temp table
create temp table _first_result as
select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{}'::jsonb
) as result;

select is(
  (select (result->>'applied') from _first_result),
  'true',
  'first engagement call returns applied=true'
);

select is(
  (select (result->>'first_engagement') from _first_result),
  'true',
  'first call returns first_engagement=true'
);

select is(
  (
    select seen_count::text
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  '1',
  'seen_count is 1 after first insert'
);

-- Second call should upsert (increment)
create temp table _second_result as
select message_dispatcher.message_dispatcher_record_engagement(
  (select dispatch_id from _fixture),
  'opened'::message_dispatcher.message_engagement_type,
  'resend_webhook',
  '{}'::jsonb
) as result;

select is(
  (select (result->>'first_engagement') from _second_result),
  'false',
  'second call returns first_engagement=false'
);

select is(
  (
    select seen_count::text
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  '2',
  'seen_count increments to 2 after second call'
);

select ok(
  (
    select last_seen_at >= first_seen_at
    from message_dispatcher.message_dispatch_engagements e
    join _fixture f on e.dispatch_id = f.dispatch_id
    where e.engagement_type = 'opened'
  ),
  'last_seen_at >= first_seen_at after upsert'
);

select finish();

rollback;
