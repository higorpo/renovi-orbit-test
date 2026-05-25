-- pgTAP: ingest with non-existent profile_id fails on FK constraint.

begin;

select plan(1);

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000001'::uuid,
      'email'::message_dispatcher.message_channel,
      'welcome_template'
    )
  $test$,
  '23503',
  null,
  'non-existent profile_id raises FK violation 23503'
);

select finish();

rollback;
