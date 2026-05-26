-- pgTAP: record_engagement with invalid dispatch_id returns error.

begin;

select plan(1);

select is(
  (
    select message_dispatcher.message_dispatcher_record_engagement(
      gen_random_uuid(),
      'opened'::message_dispatcher.message_engagement_type,
      'resend_webhook',
      '{}'::jsonb
    )->>'reason'
  ),
  'dispatch_not_found',
  'invalid dispatch_id returns dispatch_not_found'
);

select finish();

rollback;
