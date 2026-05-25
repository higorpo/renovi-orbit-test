-- pgTAP: message_dispatcher_audit indexes (design §3.6, task 19).

begin;

select plan(2);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'message_dispatcher'
      and tablename = 'message_dispatcher_audit'
      and indexname = 'message_dispatcher_audit_dispatch_created_idx'
  ),
  'dispatch_id created_at desc index'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'message_dispatcher'
      and tablename = 'message_dispatcher_audit'
      and indexname = 'message_dispatcher_audit_profile_created_idx'
  ),
  'profile_id created_at desc index'
);

select finish();

rollback;
