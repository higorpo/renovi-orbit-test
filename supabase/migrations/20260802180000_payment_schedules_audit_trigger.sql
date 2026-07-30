-- Row-level history for payment_schedules (append-only).
-- Design goals for high write volume:
--   1. Statement-level AFTER triggers + transition tables → one bulk INSERT per statement
--      (PG forbids transition tables on multi-event triggers, so three single-event
--      triggers share one function via the common alias `changed_rows`).
--   2. row_version lives ONLY on the audit table; next value assigned set-based
--      (DISTINCT ON max join), not per-row scalar lookups.
--   3. No FKs from audit → source (append never waits on FK checks / parent locks).
--   4. Minimal indexes: unique (id, row_version DESC) + BRIN(audited_at).
--   5. Append-only: deny UPDATE/DELETE/TRUNCATE; writes only via SECURITY DEFINER trigger
--      (service_role has SELECT only — cannot forge history via Data API).
-- Distinct from payment_audit_log (domain lifecycle events). This table stores full row snapshots.

-- ---------------------------------------------------------------------------
-- Audit table (columnar snapshot of payment_schedules + event metadata)
-- ---------------------------------------------------------------------------

create table public.payment_schedules_audit (
  like public.payment_schedules
    excluding defaults
    excluding constraints
    excluding indexes
);

alter table public.payment_schedules_audit
  add column audit_id bigint generated always as identity (cache 1000),
  add column audit_op text not null,
  add column audited_at timestamptz not null default now(),
  add column audited_by uuid,
  add column audited_role text,
  add column row_version bigint not null,
  add column audit_txid xid8 not null default pg_current_xact_id(),
  add primary key (audit_id),
  add constraint payment_schedules_audit_op_check
    check (audit_op in ('INSERT', 'UPDATE', 'DELETE')),
  add constraint payment_schedules_audit_row_version_positive_check
    check (row_version > 0);

comment on table public.payment_schedules_audit is
  'Append-only full-row history of payment_schedules. Written only by statement-level trigger.';

comment on column public.payment_schedules_audit.audit_id is
  'Global identity PK; CACHE 1000 on the backing sequence for concurrent inserts.';

comment on column public.payment_schedules_audit.audit_op is
  'DML that produced this snapshot: INSERT, UPDATE, or DELETE.';

comment on column public.payment_schedules_audit.audited_at is
  'Transaction time of the audit write (now() of the mutating transaction).';

comment on column public.payment_schedules_audit.audited_by is
  'auth.uid() of the session that mutated payment_schedules (null for service_role/system).';

comment on column public.payment_schedules_audit.audited_role is
  'JWT role (or auth.role()) of the mutating session at write time.';

comment on column public.payment_schedules_audit.row_version is
  'Per-schedule monotonic version assigned only on audit insert (not stored on payment_schedules).';

comment on column public.payment_schedules_audit.audit_txid is
  'pg_current_xact_id() at write time; correlate with other writes in the same transaction.';

comment on column public.payment_schedules_audit.id is
  'payment_schedules.id snapshot; not unique here (one row per version).';

create unique index payment_schedules_audit_id_version_idx
  on public.payment_schedules_audit (id, row_version desc);

create index payment_schedules_audit_audited_at_brin
  on public.payment_schedules_audit using brin (audited_at);

create index payment_schedules_audit_txid_idx
  on public.payment_schedules_audit (audit_txid);

-- ---------------------------------------------------------------------------
-- Shared statement-level writer (set-based version; one column list)
-- ---------------------------------------------------------------------------

create or replace function public.payment_schedules_audit_after_stmt()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.payment_schedules_audit (
    id,
    contracted_service_id,
    client_id,
    provider_id,
    gateway_slug,
    client_card_token_id,
    installment_number,
    base_amount,
    commission_rate_pct,
    provider_payout,
    charge_scheduled_at,
    state,
    automatic_attempt_count,
    manual_attempt_count,
    max_attempts,
    locked_until,
    next_retry_at,
    idempotency_key,
    clearsale_session_id,
    client_ip_address,
    upcoming_charge_notified_at,
    is_disputed,
    needs_payment_method_update,
    gateway_charge_id,
    gateway_transaction_id,
    gateway_reference_code,
    paid_at,
    failed_at,
    failed_permanently_at,
    cancelled_at,
    refunded_at,
    paid_amount,
    claimed_charge_amount,
    refunded_amount,
    refund_submit_status,
    refund_anchor_execution_at,
    failure_code,
    failure_reason,
    cancellation_reason,
    reconciliation_failure_count,
    created_at,
    updated_at,
    charge_frozen_at,
    far_recapture_pending_at,
    supersedes_schedule_id,
    row_version,
    audit_op,
    audited_at,
    audited_by,
    audited_role,
    audit_txid
  )
  select
    c.id,
    c.contracted_service_id,
    c.client_id,
    c.provider_id,
    c.gateway_slug,
    c.client_card_token_id,
    c.installment_number,
    c.base_amount,
    c.commission_rate_pct,
    c.provider_payout,
    c.charge_scheduled_at,
    c.state,
    c.automatic_attempt_count,
    c.manual_attempt_count,
    c.max_attempts,
    c.locked_until,
    c.next_retry_at,
    c.idempotency_key,
    c.clearsale_session_id,
    c.client_ip_address,
    c.upcoming_charge_notified_at,
    c.is_disputed,
    c.needs_payment_method_update,
    c.gateway_charge_id,
    c.gateway_transaction_id,
    c.gateway_reference_code,
    c.paid_at,
    c.failed_at,
    c.failed_permanently_at,
    c.cancelled_at,
    c.refunded_at,
    c.paid_amount,
    c.claimed_charge_amount,
    c.refunded_amount,
    c.refund_submit_status,
    c.refund_anchor_execution_at,
    c.failure_code,
    c.failure_reason,
    c.cancellation_reason,
    c.reconciliation_failure_count,
    c.created_at,
    c.updated_at,
    c.charge_frozen_at,
    c.far_recapture_pending_at,
    c.supersedes_schedule_id,
    coalesce(v.max_rv, 0) + 1,
    tg_op,
    now(),
    (select auth.uid()),
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      auth.role()
    ),
    pg_current_xact_id()
  from changed_rows c
  left join (
    select distinct on (a.id)
      a.id,
      a.row_version as max_rv
    from public.payment_schedules_audit a
    where a.id in (select s.id from changed_rows s)
    order by a.id, a.row_version desc
  ) v on v.id = c.id;

  return null;
end;
$$;

comment on function public.payment_schedules_audit_after_stmt() is
  'AFTER INSERT/UPDATE/DELETE STATEMENT: set-based snapshot into payment_schedules_audit via changed_rows.';

drop trigger if exists payment_schedules_audit_after_insert on public.payment_schedules;
drop trigger if exists payment_schedules_audit_after_update on public.payment_schedules;
drop trigger if exists payment_schedules_audit_after_delete on public.payment_schedules;
drop trigger if exists payment_schedules_audit_stmt on public.payment_schedules;
drop trigger if exists payment_schedules_audit_stmt_insert on public.payment_schedules;
drop trigger if exists payment_schedules_audit_stmt_update on public.payment_schedules;
drop trigger if exists payment_schedules_audit_stmt_delete on public.payment_schedules;

drop function if exists public.payment_schedules_audit_after_insert();
drop function if exists public.payment_schedules_audit_after_update();
drop function if exists public.payment_schedules_audit_after_delete();
drop function if exists public.payment_schedules_audit_next_version(uuid);

-- Single-event triggers required: PG disallows transition tables on multi-event triggers.
create trigger payment_schedules_audit_stmt_insert
  after insert on public.payment_schedules
  referencing new table as changed_rows
  for each statement
  execute function public.payment_schedules_audit_after_stmt();

create trigger payment_schedules_audit_stmt_update
  after update on public.payment_schedules
  referencing new table as changed_rows
  for each statement
  execute function public.payment_schedules_audit_after_stmt();

create trigger payment_schedules_audit_stmt_delete
  after delete on public.payment_schedules
  referencing old table as changed_rows
  for each statement
  execute function public.payment_schedules_audit_after_stmt();

-- ---------------------------------------------------------------------------
-- Append-only + privileges
-- ---------------------------------------------------------------------------

drop trigger if exists payment_schedules_audit_deny_mutation on public.payment_schedules_audit;

create trigger payment_schedules_audit_deny_mutation
  before update or delete on public.payment_schedules_audit
  for each row
  execute function public.payment_deny_row_mutation();

comment on trigger payment_schedules_audit_deny_mutation on public.payment_schedules_audit is
  'Blocks UPDATE/DELETE; audit snapshots are immutable after INSERT.';

create or replace function public.payment_schedules_audit_deny_truncate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'PAYMENT_APPEND_ONLY_TABLE'
    using
      errcode = 'P0001',
      detail = jsonb_build_object(
        'code', 'PAYMENT_APPEND_ONLY_TABLE',
        'table', tg_table_name,
        'op', 'TRUNCATE'
      )::text;
end;
$$;

comment on function public.payment_schedules_audit_deny_truncate() is
  'BEFORE TRUNCATE: blocks wipe of append-only payment_schedules_audit.';

drop trigger if exists payment_schedules_audit_deny_truncate on public.payment_schedules_audit;

create trigger payment_schedules_audit_deny_truncate
  before truncate on public.payment_schedules_audit
  for each statement
  execute function public.payment_schedules_audit_deny_truncate();

alter table public.payment_schedules_audit enable row level security;

drop policy if exists payment_schedules_audit_select_admin on public.payment_schedules_audit;

create policy payment_schedules_audit_select_admin
  on public.payment_schedules_audit
  for select
  to authenticated
  using ((select public.is_platform_admin()));

revoke all on table public.payment_schedules_audit from public;
revoke all on table public.payment_schedules_audit from anon;
revoke all on table public.payment_schedules_audit from authenticated;
revoke all on table public.payment_schedules_audit from service_role;

-- Admin UI via PostgREST (RLS-gated). Writes only via SECURITY DEFINER trigger (table owner).
grant select on table public.payment_schedules_audit to authenticated;
grant select on table public.payment_schedules_audit to service_role;

revoke insert, update, delete, truncate on table public.payment_schedules_audit from public;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from anon;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from authenticated;
revoke insert, update, delete, truncate on table public.payment_schedules_audit from service_role;

revoke all on function public.payment_schedules_audit_after_stmt() from public;
revoke all on function public.payment_schedules_audit_after_stmt() from anon;
revoke all on function public.payment_schedules_audit_after_stmt() from authenticated;

revoke all on function public.payment_schedules_audit_deny_truncate() from public;
revoke all on function public.payment_schedules_audit_deny_truncate() from anon;
revoke all on function public.payment_schedules_audit_deny_truncate() from authenticated;
