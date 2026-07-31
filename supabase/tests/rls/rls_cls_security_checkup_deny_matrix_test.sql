-- pgTAP: consolidated RLS/CLS security checkup deny matrix.
-- Extensible checklist — add rows to _deny_expectations (or a new section) for new findings.
-- Finding ids map to checkup remediations (migrations 20260802260000–20260802320000).

begin;

create temp table _deny_expectations (
  finding_id text not null,
  kind text not null check (kind in ('table', 'column', 'function')),
  role_name text not null,
  object_ref text not null,
  privilege text not null,
  note text not null
);

-- ---------------------------------------------------------------------------
-- RLS-CLS-001 — disable_device_beacon execute deny
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  (
    'RLS-CLS-001',
    'function',
    'authenticated',
    'message_dispatcher.message_dispatcher_disable_device_beacon(uuid,text)',
    'EXECUTE',
    'disable_device_beacon authenticated EXECUTE denied'
  ),
  (
    'RLS-CLS-001',
    'function',
    'anon',
    'message_dispatcher.message_dispatcher_disable_device_beacon(uuid,text)',
    'EXECUTE',
    'disable_device_beacon anon EXECUTE denied'
  );

-- ---------------------------------------------------------------------------
-- RLS-CLS-002 — storage foreign-bucket write deny (structural: denied policies gone)
-- Covered behaviorally in storage_chat_media_foreign_bucket_deny_test.sql.
-- Privilege probe: chat-media has no authenticated INSERT policy (default deny).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS-CLS-003 — get_service any-provider access (ACCEPTED product rule)
-- Any authenticated provider with the link may read the SR (masked address until
-- acceptance). Not a deny finding. Coverage:
-- view-services/service_viewer_access_deny_test.sql + view_services_rpcs_test.sql
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS-CLS-004 — payment views DML deny (SELECT kept)
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  ('RLS-CLS-004', 'table', 'authenticated', 'public.client_payment_transactions_v', 'INSERT', 'client_payment_transactions_v INSERT denied'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.client_payment_transactions_v', 'UPDATE', 'client_payment_transactions_v UPDATE denied'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.client_payment_transactions_v', 'DELETE', 'client_payment_transactions_v DELETE denied'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.provider_payment_receivables_v', 'INSERT', 'provider_payment_receivables_v INSERT denied'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.provider_settlement_movements_v', 'UPDATE', 'provider_settlement_movements_v UPDATE denied'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.provider_settlement_movements_v', 'DELETE', 'provider_settlement_movements_v DELETE denied');

-- ---------------------------------------------------------------------------
-- RLS-CLS-005 — snapshot helper execute deny
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  (
    'RLS-CLS-005',
    'function',
    'authenticated',
    'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)',
    'EXECUTE',
    'reschedule snapshot helper authenticated EXECUTE denied'
  ),
  (
    'RLS-CLS-005',
    'function',
    'anon',
    'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)',
    'EXECUTE',
    'reschedule snapshot helper anon EXECUTE denied'
  );

-- ---------------------------------------------------------------------------
-- RLS-CLS-006 — KYC helpers execute deny
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  (
    'RLS-CLS-006',
    'function',
    'authenticated',
    'public.payment_provider_kyc_storage_path_valid(uuid, text)',
    'EXECUTE',
    'kyc path valid authenticated EXECUTE denied'
  ),
  (
    'RLS-CLS-006',
    'function',
    'authenticated',
    'public.payment_assert_provider_kyc_storage_path(uuid, text, text)',
    'EXECUTE',
    'kyc assert path authenticated EXECUTE denied'
  ),
  (
    'RLS-CLS-006',
    'function',
    'authenticated',
    'public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])',
    'EXECUTE',
    'kyc link sessions authenticated EXECUTE denied'
  );

-- ---------------------------------------------------------------------------
-- RLS-CLS-007 — schedules_audit sensitive column privilege deny
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.base_amount', 'SELECT', 'audit base_amount CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.commission_rate_pct', 'SELECT', 'audit commission_rate_pct CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.provider_payout', 'SELECT', 'audit provider_payout CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.client_card_token_id', 'SELECT', 'audit client_card_token_id CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.client_ip_address', 'SELECT', 'audit client_ip_address CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.gateway_transaction_id', 'SELECT', 'audit gateway_transaction_id CLS deny'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.idempotency_key', 'SELECT', 'audit idempotency_key CLS deny');

-- ---------------------------------------------------------------------------
-- RLS-CLS-008 — settlement table select deny for authenticated
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  ('RLS-CLS-008', 'table', 'authenticated', 'public.payment_settlement_movements', 'SELECT', 'settlement_movements SELECT denied'),
  ('RLS-CLS-008', 'table', 'authenticated', 'public.payment_settlement_movements', 'INSERT', 'settlement_movements INSERT denied'),
  ('RLS-CLS-008', 'column', 'authenticated', 'public.payment_settlement_movements.raw_snapshot', 'SELECT', 'settlement raw_snapshot CLS deny');

-- ---------------------------------------------------------------------------
-- RLS-CLS-009 — grant hygiene samples (locations, constants, anon PII, orphans, triggers)
-- ---------------------------------------------------------------------------
insert into _deny_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  ('RLS-CLS-009', 'table', 'authenticated', 'public.provider_latest_locations', 'SELECT', 'provider_latest_locations SELECT denied'),
  ('RLS-CLS-009', 'table', 'authenticated', 'public.provider_rating_stats', 'SELECT', 'provider_rating_stats SELECT denied'),
  ('RLS-CLS-009', 'table', 'anon', 'public.provider_rating_stats', 'SELECT', 'provider_rating_stats anon SELECT denied'),
  ('RLS-CLS-009', 'table', 'authenticated', 'public.platform_constants', 'SELECT', 'platform_constants SELECT denied'),
  ('RLS-CLS-009', 'table', 'anon', 'public.client_profiles_private', 'SELECT', 'anon PII client_profiles_private SELECT denied'),
  ('RLS-CLS-009', 'table', 'anon', 'public.provider_profiles_private', 'SELECT', 'anon PII provider_profiles_private SELECT denied'),
  ('RLS-CLS-009', 'function', 'authenticated', 'message_dispatcher.message_dispatcher_cancel(uuid, text)', 'EXECUTE', 'message_dispatcher_cancel authenticated EXECUTE denied'),
  ('RLS-CLS-009', 'function', 'authenticated', 'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)', 'EXECUTE', 'submit_service_rating authenticated EXECUTE denied'),
  ('RLS-CLS-009', 'function', 'authenticated', 'public.update_service_rating(uuid, smallint, smallint, smallint, smallint, text)', 'EXECUTE', 'update_service_rating authenticated EXECUTE denied'),
  ('RLS-CLS-009', 'function', 'authenticated', 'public.trg_chat_messages_notify_fn()', 'EXECUTE', 'trigger trg_chat_messages_notify_fn EXECUTE denied');

-- Positive controls (must remain granted)
create temp table _allow_expectations (
  finding_id text not null,
  kind text not null check (kind in ('table', 'column', 'function')),
  role_name text not null,
  object_ref text not null,
  privilege text not null,
  note text not null
);

insert into _allow_expectations (finding_id, kind, role_name, object_ref, privilege, note) values
  ('RLS-CLS-001', 'function', 'service_role', 'message_dispatcher.message_dispatcher_disable_device_beacon(uuid,text)', 'EXECUTE', 'disable_device_beacon service_role EXECUTE kept'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.client_payment_transactions_v', 'SELECT', 'client_payment_transactions_v SELECT kept'),
  ('RLS-CLS-004', 'table', 'authenticated', 'public.provider_settlement_movements_v', 'SELECT', 'provider_settlement_movements_v SELECT kept'),
  ('RLS-CLS-005', 'function', 'service_role', 'public.cns_service_reschedule_snapshot_for_request(uuid, uuid)', 'EXECUTE', 'snapshot helper service_role EXECUTE kept'),
  ('RLS-CLS-007', 'column', 'authenticated', 'public.payment_schedules_audit.state', 'SELECT', 'audit state SELECT allowlist kept'),
  ('RLS-CLS-008', 'table', 'service_role', 'public.payment_settlement_movements', 'SELECT', 'settlement_movements service_role SELECT kept'),
  ('RLS-CLS-009', 'table', 'authenticated', 'public.platform_services', 'SELECT', 'platform_services catalog SELECT kept'),
  ('RLS-CLS-009', 'function', 'service_role', 'public.submit_service_rating(uuid, smallint, smallint, smallint, smallint, text)', 'EXECUTE', 'submit_service_rating service_role EXECUTE kept');

select plan(
  (
    select count(*)::int
    from (
      select 1 from _deny_expectations
      union all
      select 1 from _allow_expectations
      union all
      select 1 -- RLS-CLS-002 structural
      union all
      select 1 -- RLS-CLS-002 chat-media insert denied policies gone
    ) t
  )
);

-- Evaluate privilege matrix ---------------------------------------------------

create or replace function pg_temp.eval_privilege_denied(
  p_kind text,
  p_role text,
  p_object text,
  p_priv text
)
returns boolean
language plpgsql
as $$
begin
  if p_kind = 'table' then
    return not has_table_privilege(p_role, p_object, p_priv);
  elsif p_kind = 'column' then
    return not has_column_privilege(
      p_role,
      split_part(p_object, '.', 1) || '.' || split_part(p_object, '.', 2),
      split_part(p_object, '.', 3),
      p_priv
    );
  elsif p_kind = 'function' then
    return not has_function_privilege(p_role, p_object::regprocedure, p_priv);
  end if;
  return false;
end;
$$;

create or replace function pg_temp.eval_privilege_allowed(
  p_kind text,
  p_role text,
  p_object text,
  p_priv text
)
returns boolean
language plpgsql
as $$
begin
  if p_kind = 'table' then
    return has_table_privilege(p_role, p_object, p_priv);
  elsif p_kind = 'column' then
    return has_column_privilege(
      p_role,
      split_part(p_object, '.', 1) || '.' || split_part(p_object, '.', 2),
      split_part(p_object, '.', 3),
      p_priv
    );
  elsif p_kind = 'function' then
    return has_function_privilege(p_role, p_object::regprocedure, p_priv);
  end if;
  return false;
end;
$$;

select ok(
  pg_temp.eval_privilege_denied(e.kind, e.role_name, e.object_ref, e.privilege),
  format('%s: %s', e.finding_id, e.note)
)
from _deny_expectations e
order by e.finding_id, e.note;

select ok(
  pg_temp.eval_privilege_allowed(e.kind, e.role_name, e.object_ref, e.privilege),
  format('%s: %s', e.finding_id, e.note)
)
from _allow_expectations e
order by e.finding_id, e.note;

-- RLS-CLS-002 structural probes -----------------------------------------------
select ok(
  (
    select count(*)::int = 0
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'storage_objects_chat_media_insert_denied',
        'storage_objects_chat_media_update_denied',
        'storage_objects_chat_media_delete_denied'
      )
  ),
  'RLS-CLS-002: storage chat-media *_denied policies dropped'
);

select ok(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_objects_chat_media_select'
  ) = 1,
  'RLS-CLS-002: storage_objects_chat_media_select retained'
);

select * from finish();

rollback;
