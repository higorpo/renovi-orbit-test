-- pgTAP: payment_schedules_audit — statement-level history on INSERT/UPDATE/DELETE.

begin;

select plan(16);

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
  to_regclass('public.payment_schedules_audit') is not null,
  'payment_schedules_audit table exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_schedules_audit'
      and column_name = 'row_version'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_schedules_audit'
      and column_name = 'audit_txid'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_schedules'
      and column_name = 'row_version'
  ),
  'row_version and audit_txid exist only on payment_schedules_audit'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_schedules'
      and t.tgname = 'payment_schedules_audit_stmt_insert'
      and not t.tgisinternal
  )
  and exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_schedules'
      and t.tgname = 'payment_schedules_audit_stmt_update'
      and not t.tgisinternal
  )
  and exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_schedules'
      and t.tgname = 'payment_schedules_audit_stmt_delete'
      and not t.tgisinternal
  )
  and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_schedules_audit_next_version'
  ),
  'three single-event statement triggers share after_stmt; next_version removed'
);

select ok(
  (
    select count(*)::int = 0
    from information_schema.columns src
    where src.table_schema = 'public'
      and src.table_name = 'payment_schedules'
      and src.column_name not in (
        select a.column_name
        from information_schema.columns a
        where a.table_schema = 'public'
          and a.table_name = 'payment_schedules_audit'
      )
  ),
  'every payment_schedules column exists on payment_schedules_audit (drift guard)'
);

do $seed$
declare
  v_schedule_id uuid;
  v_service_id uuid := gen_random_uuid();
  v_service_request_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_pricing record;
  v_slot jsonb;
begin
  select sr.client_id
  into v_client_id
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  insert into public.service_requests (
    id, client_id, service_id, address_id, title, description,
    form_data, form_version, status, urgency
  )
  select
    v_service_request_id, sr.client_id, sr.service_id, sr.address_id,
    format('schedules audit pgTAP %s', v_service_id),
    sr.description, sr.form_data, sr.form_version, 'OPEN', sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

  perform set_config('request.jwt.claim.sub', v_provider_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_provider_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into v_pricing
  from public.calculate_provider_service_pricing(100.00::numeric);

  perform pg_temp.payment_set_service_role();

  v_slot := jsonb_build_object(
    'start_date', to_char(current_date + 3, 'YYYY-MM-DD'),
    'shift', 'morning'
  );

  insert into public.provider_proposals (
    id, provider_id, service_request_id, proposed_amount, proposal_description,
    proposal_duration_value, proposal_duration_unit, proposal_suggested_slots,
    photos, tax_rate, tax_amount, final_amount, pricing_signature, status
  )
  values (
    v_proposal_id, v_provider_id, v_service_request_id, v_pricing.original_amount,
    'schedules audit pgTAP proposal', 2, 'hours', jsonb_build_array(v_slot),
    '{}'::text[], v_pricing.tax_rate, v_pricing.tax_amount, v_pricing.final_amount,
    v_pricing.pricing_signature, 'ACCEPTED'::public.proposal_status
  );

  insert into public.contracted_services (
    id, service_request_id, accepted_proposal_id, client_id, provider_id,
    duration_unit, duration_value, scheduled_start_date, scheduled_shift,
    agreed_slot, status
  )
  values (
    v_service_id, v_service_request_id, v_proposal_id, v_client_id,
    v_provider_id, 'hours', 2, current_date + 3, 'morning', v_slot,
    'PENDING_PAYMENT'::public.contracted_service_status
  );

  insert into public.payment_schedules (
    contracted_service_id, client_id, provider_id, installment_number,
    base_amount, commission_rate_pct, provider_payout, charge_scheduled_at,
    state, idempotency_key, gateway_reference_code
  )
  values (
    v_service_id, v_client_id, v_provider_id, 1,
    100.00, 10.00, 90.00, now() + interval '2 days',
    'SCHEDULED'::public.payment_schedule_state, v_service_id::text, v_service_id
  )
  returning id into v_schedule_id;

  perform set_config('test.schedules_audit.schedule_id', v_schedule_id::text, true);
  perform set_config('test.schedules_audit.service_id', v_service_id::text, true);
end;
$seed$;

select is(
  (
    select count(*)::int
    from public.payment_schedules_audit a
    where a.id = current_setting('test.schedules_audit.schedule_id')::uuid
      and a.audit_op = 'INSERT'
      and a.row_version = 1
      and a.state = 'SCHEDULED'::public.payment_schedule_state
  ),
  1,
  'INSERT writes one audit snapshot at row_version 1'
);

select ok(
  (
    select a.audit_txid is not null
    from public.payment_schedules_audit a
    where a.id = current_setting('test.schedules_audit.schedule_id')::uuid
      and a.audit_op = 'INSERT'
  ),
  'INSERT audit row records audit_txid'
);

select lives_ok(
  format(
    $$ update public.payment_schedules
       set next_retry_at = now() + interval '1 hour'
       where id = %L::uuid $$,
    current_setting('test.schedules_audit.schedule_id')
  ),
  'UPDATE payment_schedules succeeds with audit trigger'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules_audit a
    where a.id = current_setting('test.schedules_audit.schedule_id')::uuid
      and a.audit_op = 'UPDATE'
      and a.row_version = 2
  ),
  1,
  'UPDATE writes one audit snapshot at row_version 2'
);

select lives_ok(
  format(
    $$
      update public.payment_schedules
      set next_retry_at = now() + interval '2 hours'
      where id = %L::uuid;
      update public.payment_schedules
      set next_retry_at = now() + interval '3 hours'
      where id = %L::uuid;
    $$,
    current_setting('test.schedules_audit.schedule_id'),
    current_setting('test.schedules_audit.schedule_id')
  ),
  'two sequential UPDATEs succeed'
);

select is(
  (
    select array_agg(a.row_version order by a.row_version)
    from public.payment_schedules_audit a
    where a.id = current_setting('test.schedules_audit.schedule_id')::uuid
  ),
  array[1::bigint, 2::bigint, 3::bigint, 4::bigint],
  'audit versions are contiguous 1..4 after insert + 3 updates'
);

select lives_ok(
  format(
    $$ delete from public.payment_schedules where id = %L::uuid $$,
    current_setting('test.schedules_audit.schedule_id')
  ),
  'DELETE payment_schedules succeeds with audit trigger'
);

select is(
  (
    select count(*)::int
    from public.payment_schedules_audit a
    where a.id = current_setting('test.schedules_audit.schedule_id')::uuid
      and a.audit_op = 'DELETE'
      and a.row_version = 5
  ),
  1,
  'DELETE writes audit snapshot at next row_version (5)'
);

select throws_ok(
  format(
    $$ update public.payment_schedules_audit
       set audit_op = 'TAMPERED'
       where id = %L::uuid
         and audit_op = 'INSERT' $$,
    current_setting('test.schedules_audit.schedule_id')
  ),
  'P0001',
  'PAYMENT_APPEND_ONLY_TABLE',
  'UPDATE on payment_schedules_audit is blocked'
);

select throws_ok(
  $$
    set local role service_role;
    insert into public.payment_schedules_audit (
      id, contracted_service_id, client_id, provider_id,
      installment_number, base_amount, commission_rate_pct, provider_payout,
      charge_scheduled_at, state, idempotency_key, gateway_reference_code,
      row_version, audit_op
    ) values (
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      1, 1.00, 1.00, 1.00,
      now(), 'SCHEDULED', gen_random_uuid()::text, gen_random_uuid(),
      1, 'INSERT'
    );
  $$,
  '42501',
  'permission denied for table payment_schedules_audit',
  'service_role cannot INSERT into payment_schedules_audit (trigger-only writes)'
);

select ok(
  not has_table_privilege('service_role', 'public.payment_schedules_audit', 'INSERT')
    and not has_table_privilege('service_role', 'public.payment_schedules_audit', 'UPDATE')
    and not has_table_privilege('service_role', 'public.payment_schedules_audit', 'DELETE')
    and not has_table_privilege('service_role', 'public.payment_schedules_audit', 'TRUNCATE')
    and has_table_privilege('service_role', 'public.payment_schedules_audit', 'SELECT'),
  'service_role can SELECT audit only; no INSERT/UPDATE/DELETE/TRUNCATE'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.payment_schedules_audit_after_stmt()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.payment_schedules_audit_after_stmt()',
    'EXECUTE'
  ),
  'clients cannot EXECUTE audit trigger function'
);

select * from finish();

rollback;
