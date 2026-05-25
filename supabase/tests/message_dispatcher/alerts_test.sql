-- pgTAP: SQL alerts queue lag / terminal spike / janitor (design §10.5, task 84).

begin;

select plan(8);

select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname = 'alert_queue_lag_v'
  ),
  'alert_queue_lag_v exists'
);

select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname = 'alert_terminal_spike_v'
  ),
  'alert_terminal_spike_v exists'
);

select ok(
  exists (
    select 1
    from pg_views v
    where v.schemaname = 'message_dispatcher'
      and v.viewname = 'alert_janitor_churn_v'
  ),
  'alert_janitor_churn_v exists'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_evaluate_alerts'
  ),
  'message_dispatcher_evaluate_alerts exists'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_evaluate_alerts()$$,
  'evaluate_alerts runs without error'
);

select ok(
  (message_dispatcher.message_dispatcher_evaluate_alerts() ? 'queue_lag')
    and (message_dispatcher.message_dispatcher_evaluate_alerts() ? 'terminal_spike')
    and (message_dispatcher.message_dispatcher_evaluate_alerts() ? 'janitor_churn')
    and (message_dispatcher.message_dispatcher_evaluate_alerts() ? 'retryable_depth'),
  'evaluate_alerts returns all alert keys including retryable_depth'
);

select lives_ok(
  $$select message_dispatcher.message_dispatcher_refresh_stats()$$,
  'refresh_stats includes alert snapshots'
);

select ok(
  (select count(*) = 4
   from message_dispatcher.message_dispatcher_stats s
   where s.metric_name in (
     'mmd_alert_queue_lag',
     'mmd_alert_terminal_spike',
     'mmd_alert_janitor_churn',
     'mmd_alert_retryable_depth'
   )),
  'refresh_stats writes four alert metric rows'
);

select finish();

rollback;
