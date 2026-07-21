-- pgTAP: FIX-012 / CHK-037 — dispute handler dual MMD + sentry_alert payload.

begin;

select plan(1);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'transaction-dispute:%s:provider'
      and pg_get_functiondef(p.oid) ~ 'transaction-dispute:%s:client'
      and pg_get_functiondef(p.oid) ~ 'sentry_alert'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_webhook_handle_dispute'
  ),
  'CHK-037: dispute handler notifies client+provider and returns sentry_alert'
);

select * from finish();

rollback;
