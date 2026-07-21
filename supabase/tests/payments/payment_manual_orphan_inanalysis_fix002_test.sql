-- pgTAP: FIX-002 — ambiguous manual timeout orphan routes to IN_ANALYSIS.

begin;

select plan(3);

create or replace function pg_temp.payment_set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

select ok(
  (
    select pg_get_functiondef(p.oid) ~*
      'manual_attempt_count > 0 then ''IN_ANALYSIS'''
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_recover_orphaned_schedules'
  ),
  'payment_recover_orphaned_schedules routes manual_attempt_count > 0 to IN_ANALYSIS'
);

select ok(
  (
    select pg_get_functiondef(p.oid) !~*
      'gateway_reference_code = gen_random_uuid'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_begin_manual_attempt'
  ),
  'payment_begin_manual_attempt does not rotate gateway_reference_code on lease'
);

select ok(
  (
    select pg_get_functiondef(p.oid) ~* 'IN_ANALYSIS'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_recover_orphaned_schedules'
  ),
  'orphan recovery function still references IN_ANALYSIS routing'
);

select finish();

rollback;
