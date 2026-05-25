-- pgTAP: FAILED_RETRYABLE depth backpressure alert (design §9.5, task 109).

begin;

select plan(6);

select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname = 'alert_retryable_depth_v'
  ),
  'alert_retryable_depth_v exists'
);

select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname = 'alert_retryable_by_source_v'
  ),
  'alert_retryable_by_source_v exists'
);

select is(
  (
    select (value #>> '{}')::bigint
    from public.platform_constants
    where key = 'message_dispatcher.retryable_depth_alert_threshold'
  ),
  10000::bigint,
  'retryable_depth_alert_threshold defaults to 10000'
);

select ok(
  message_dispatcher.message_dispatcher_evaluate_alerts() ? 'retryable_depth',
  'evaluate_alerts includes retryable_depth'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_refresh_stats()$$,
  'refresh_stats runs with retryable depth alert'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatcher_stats s
    where s.metric_name = 'mmd_alert_retryable_depth'
  ),
  'refresh_stats writes mmd_alert_retryable_depth'
);

select finish();

rollback;
