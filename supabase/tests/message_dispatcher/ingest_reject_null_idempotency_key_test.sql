-- pgTAP: ingest rejects NULL p_idempotency_key (design §5.1, task 21, Req.5 AC2).

begin;

select plan(2);

create temp table _null_key_pre_count as
select count(*)::bigint as cnt from message_dispatcher.message_dispatches;

select throws_ok(
  $test$
    select message_dispatcher.message_dispatcher_ingest(
      null,
      gen_random_uuid(),
      'email'::message_dispatcher.message_channel,
      'welcome_template',
      '{}'::jsonb
    )
  $test$,
  '22023',
  'p_idempotency_key is required',
  'NULL idempotency_key raises 22023'
);

select is(
  (select count(*)::bigint from message_dispatcher.message_dispatches),
  (select cnt from _null_key_pre_count),
  'no dispatch row after NULL key rejection'
);

select finish();

rollback;
