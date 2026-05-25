-- pgTAP: checkout returns jsonb_agg DTO array with required fields (design §5.3, task 49, Req.5 AC3).

begin;

select plan(4);

select is(
  jsonb_typeof(message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-dto-empty')),
  'array',
  'checkout returns JSON array'
);

create temp table _dto_email_fixture as
select
  '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid as profile_id,
  gen_random_uuid() as dispatch_id,
  gen_random_uuid() as correlation_id;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  correlation_id,
  status,
  scheduled_for
)
select
  f.dispatch_id,
  gen_random_uuid(),
  f.profile_id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  '{"name":"Test"}'::jsonb,
  f.correlation_id,
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now()
from _dto_email_fixture f
where exists (
  select 1 from auth.users u where u.id = f.profile_id
);

create temp table _dto_email_payload as
select message_dispatcher.message_dispatcher_checkout_batch(1, 'worker-dto-email') as payload
where exists (select 1 from _dto_email_fixture);

select ok(
  (
    select (payload -> 0) ?& array[
      'id',
      'profile_id',
      'channel',
      'template_key',
      'template_variables',
      'correlation_id',
      'recipient_email',
      'deliveries'
    ]
    from _dto_email_payload
  ),
  'email DTO includes correlation_id, recipient_email, deliveries'
)
where exists (select 1 from _dto_email_payload);

select is(
  (select payload -> 0 ->> 'correlation_id' from _dto_email_payload),
  (select correlation_id::text from _dto_email_fixture),
  'correlation_id preserved in checkout DTO'
)
where exists (select 1 from _dto_email_payload);

select ok(
  (
    select jsonb_typeof(payload -> 0 -> 'deliveries') = 'array'
      and payload -> 0 ->> 'recipient_email' is not null
    from _dto_email_payload
  ),
  'email DTO has recipient_email and deliveries array'
)
where exists (select 1 from _dto_email_payload);

select finish();

rollback;
