-- Clear due/in-flight MMD rows so queue-sensitive pgTAP fixtures are not polluted
-- by leftover matching/product dispatches or pg_cron activity outside the test tx.
delete from message_dispatcher.message_dispatches
where status in (
  'QUEUED'::message_dispatcher.message_dispatch_status,
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status
)
and scheduled_for <= now() + interval '1 minute';
