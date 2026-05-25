-- pgTAP: audit_on_dispatch_update trigger function (design §3.6.1, task 38).

begin;

select plan(2);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_audit_on_dispatch_update'
  ),
  'audit trigger function is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type t on t.oid = p.prorettype
    where n.nspname = 'message_dispatcher'
      and p.proname = 'message_dispatcher_audit_on_dispatch_update'
      and t.typname = 'trigger'
  ),
  'returns trigger'
);

select finish();

rollback;
