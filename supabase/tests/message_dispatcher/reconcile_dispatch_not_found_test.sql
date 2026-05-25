-- pgTAP: reconcile_vendor_event with unknown vendor_message_id returns dispatch_not_found.

begin;

select plan(4);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_orphan_1',
      'resend',
      'email.delivered',
      're_does_not_exist_' || gen_random_uuid()::text,
      '{}'::jsonb
    )->>'reason'
  ),
  'dispatch_not_found',
  'unknown vendor_message_id returns dispatch_not_found'
);

select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_orphan_1',
      'resend',
      'email.delivered',
      're_does_not_exist_replay',
      '{}'::jsonb
    )->>'duplicate'
  ),
  'true',
  'replay of same vendor_event_id is duplicate noop'
);

-- NULL vendor_message_id returns missing_vendor_message_id
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_null_vmid',
      'resend',
      'email.delivered',
      null,
      '{}'::jsonb
    )->>'reason'
  ),
  'missing_vendor_message_id',
  'NULL vendor_message_id handled gracefully'
);

-- Empty vendor_message_id returns missing_vendor_message_id
select is(
  (
    select message_dispatcher.message_dispatcher_reconcile_vendor_event(
      'svix_evt_empty_vmid',
      'resend',
      'email.delivered',
      '   ',
      '{}'::jsonb
    )->>'reason'
  ),
  'missing_vendor_message_id',
  'blank vendor_message_id handled gracefully'
);

select finish();

rollback;
