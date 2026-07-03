-- pgTAP: payment Task 84 — payment_audit_log UPDATE/DELETE trigger enforcement.

begin;

select plan(4);

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

select pg_temp.payment_set_service_role();

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_audit_log'
      and t.tgname = 'payment_audit_log_deny_mutation'
      and not t.tgisinternal
  ),
  'payment_audit_log_deny_mutation trigger exists'
);

do $seed$
declare
  v_audit_id uuid;
begin
  v_audit_id := public.payment_write_audit(
    p_event_type := 'MUTATION_ENFORCEMENT_FIXTURE',
    p_entity_type := 'payment_schedule',
    p_entity_id := gen_random_uuid(),
    p_actor := 'system'::public.payment_audit_actor
  );

  perform set_config('test.audit_log.fixture_id', v_audit_id::text, true);
end;
$seed$;

select throws_ok(
  format(
    $$ update public.payment_audit_log
       set event_type = 'TAMPERED'
       where id = %L::uuid $$,
    current_setting('test.audit_log.fixture_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'UPDATE on payment_audit_log is blocked by append-only trigger'
);

select throws_ok(
  format(
    $$ delete from public.payment_audit_log
       where id = %L::uuid $$,
    current_setting('test.audit_log.fixture_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'DELETE on payment_audit_log is blocked by append-only trigger'
);

select ok(
  not has_table_privilege('service_role', 'public.payment_audit_log', 'UPDATE')
    and not has_table_privilege('service_role', 'public.payment_audit_log', 'DELETE')
    and not has_table_privilege('service_role', 'public.payment_audit_log', 'TRUNCATE'),
  'service_role lacks UPDATE, DELETE, and TRUNCATE on payment_audit_log'
);

select finish();
rollback;
