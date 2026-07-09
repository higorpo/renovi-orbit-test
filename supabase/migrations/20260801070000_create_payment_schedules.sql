-- Payment Task 9: payment_schedules (design.md §3.5, §11.2).
-- Client and provider SELECT own rows; payment history uses §3.13 views. Mutations via service_role RPCs/EFs.

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  contracted_service_id uuid not null references public.contracted_services (id) on delete restrict,
  client_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  gateway_slug public.payment_gateway_slug not null default 'netcred',
  client_card_token_id uuid references public.client_card_tokens (id) on delete restrict,
  installment_number smallint not null
    constraint payment_schedules_installment_number_check
      check (installment_number between 1 and 12),
  base_amount numeric(12, 2) not null
    constraint payment_schedules_base_amount_check
      check (base_amount > 0),
  commission_rate_pct numeric(5, 2) not null
    constraint payment_schedules_commission_rate_pct_check
      check (commission_rate_pct >= 0),
  provider_payout numeric(12, 2) not null
    constraint payment_schedules_provider_payout_check
      check (provider_payout > 0),
  charge_scheduled_at timestamptz not null,
  state public.payment_schedule_state not null default 'SCHEDULED',
  automatic_attempt_count smallint not null default 0,
  manual_attempt_count smallint not null default 0,
  max_attempts smallint not null default 3,
  locked_until timestamptz,
  next_retry_at timestamptz,
  idempotency_key text not null,
  clearsale_session_id text,
  client_ip_address text,
  upcoming_charge_notified_at timestamptz,
  is_disputed boolean not null default false,
  needs_payment_method_update boolean not null default false,
  gateway_charge_id text,
  gateway_transaction_id text,
  -- NetCred chargeCreate referenceCode (UUID). Starts as contracted_service_id;
  -- manual retries rotate to a fresh UUID so REJECTED charges can be retried.
  gateway_reference_code uuid not null,
  paid_at timestamptz,
  failed_at timestamptz,
  failed_permanently_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  paid_amount numeric(12, 2),
  refunded_amount numeric(12, 2),
  failure_code text,
  failure_reason text,
  cancellation_reason text,
  reconciliation_failure_count smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_schedules_idempotency_key_unique unique (idempotency_key),
  constraint payment_schedules_contracted_service_id_unique unique (contracted_service_id),
  constraint payment_schedules_gateway_reference_code_unique unique (gateway_reference_code),
  constraint payment_schedules_idempotency_key_matches_service_check
    check (idempotency_key = contracted_service_id::text),
  constraint payment_schedules_payout_lte_base_check
    check (provider_payout <= base_amount)
);

comment on table public.payment_schedules is
  'Authoritative charge queue; one row per contracted service. State machine source of truth.';

comment on column public.payment_schedules.client_id is
  'Denormalized from contracted_services for RLS; enforced by participant trigger and accept_proposal writer.';

comment on column public.payment_schedules.provider_id is
  'Denormalized from contracted_services for RLS; enforced by participant trigger and accept_proposal writer.';

comment on column public.payment_schedules.idempotency_key is
  'Equals contracted_service_id text; prevents duplicate schedule on accept_proposal retry.';

comment on column public.payment_schedules.max_attempts is
  'Informational snapshot at accept; cron evaluates platform_constants.max_charge_attempts at runtime.';

comment on column public.payment_schedules.clearsale_session_id is
  'Client fraud-session identifier; service_role and client participant reads only.';

comment on column public.payment_schedules.client_ip_address is
  'Client IP at accept/manual charge; service_role and client participant reads only.';

comment on column public.payment_schedules.gateway_reference_code is
  'NetCred chargeCreate referenceCode (UUID). Equals contracted_service_id initially; rotated on each manual retry.';

-- automatic_attempt_count filter uses platform_constants.max_charge_attempts at runtime (not in index).
create index payment_schedules_queue_claim_idx
  on public.payment_schedules (charge_scheduled_at, next_retry_at nulls first)
  where state in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state
  );

create index payment_schedules_stale_idx
  on public.payment_schedules (state, updated_at)
  where state in (
    'IN_ANALYSIS'::public.payment_schedule_state,
    'PROCESSING'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  );

create index payment_schedules_orphan_recovery_idx
  on public.payment_schedules (locked_until)
  where state = 'PROCESSING'::public.payment_schedule_state
    and locked_until is not null;

create index payment_schedules_upcoming_notify_idx
  on public.payment_schedules (charge_scheduled_at, id)
  where state = 'SCHEDULED'::public.payment_schedule_state
    and upcoming_charge_notified_at is null;

alter table public.payment_schedules
  add constraint payment_schedules_refunded_lte_paid_check
  check (
    refunded_amount is null
    or paid_amount is null
    or refunded_amount <= paid_amount
  )
  not valid;

alter table public.payment_schedules
  validate constraint payment_schedules_refunded_lte_paid_check;

create index payment_schedules_client_state_idx
  on public.payment_schedules (client_id, state);

create index payment_schedules_provider_state_idx
  on public.payment_schedules (provider_id, state);

create index payment_schedules_client_card_token_active_idx
  on public.payment_schedules (client_card_token_id)
  where state in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state
  );

create unique index payment_schedules_gateway_charge_id_unique_idx
  on public.payment_schedules (gateway_charge_id)
  where gateway_charge_id is not null;

create or replace function public.payment_schedules_assert_participants()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
begin
  select *
  into v_cs
  from public.contracted_services cs
  where cs.id = new.contracted_service_id;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if new.client_id is distinct from v_cs.client_id
    or new.provider_id is distinct from v_cs.provider_id then
    raise exception 'PAYMENT_SCHEDULE_PARTICIPANT_MISMATCH'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'PAYMENT_SCHEDULE_PARTICIPANT_MISMATCH')::text;
  end if;

  if new.client_card_token_id is not null then
    perform 1
    from public.client_card_tokens cct
    where cct.id = new.client_card_token_id
      and cct.client_id = new.client_id;

    if not found then
      raise exception 'CARD_TOKEN_CLIENT_MISMATCH'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'CARD_TOKEN_CLIENT_MISMATCH')::text;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.payment_schedules_assert_participants() is
  'Ensures denormalized client_id/provider_id and card token ownership match contracted_services.';

create trigger payment_schedules_assert_participants
  before insert or update on public.payment_schedules
  for each row
  execute procedure public.payment_schedules_assert_participants();

create or replace function public.payment_schedules_guard_state_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or old.state is not distinct from new.state then
    return new;
  end if;

  if old.state in (
    'PAID'::public.payment_schedule_state,
    'CANCELLED'::public.payment_schedule_state,
    'VOIDED'::public.payment_schedule_state,
    'REFUNDED'::public.payment_schedule_state,
    'PARTIALLY_REFUNDED'::public.payment_schedule_state,
    'EXPIRED'::public.payment_schedule_state
  ) then
    raise exception 'PAYMENT_SCHEDULE_TERMINAL_STATE'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PAYMENT_SCHEDULE_TERMINAL_STATE',
          'from_state', old.state,
          'to_state', new.state
        )::text;
  end if;

  if not (
    (old.state = 'SCHEDULED'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'EXPIRED'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'FAILED'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'PROCESSING'::public.payment_schedule_state
      and new.state in (
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'SCHEDULED'::public.payment_schedule_state
      ))
    or (old.state = 'IN_ANALYSIS'::public.payment_schedule_state
      and new.state in (
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'FAILED_PERMANENT'::public.payment_schedule_state
      and new.state in (
        'PROCESSING'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state,
        'IN_ANALYSIS'::public.payment_schedule_state,
        'CANCELLED'::public.payment_schedule_state
      ))
    or (old.state = 'PAID'::public.payment_schedule_state
      and new.state in (
        'REFUND_REQUESTED'::public.payment_schedule_state,
        'VOIDED'::public.payment_schedule_state
      ))
    or (old.state = 'REFUND_REQUESTED'::public.payment_schedule_state
      and new.state in (
        'REFUNDED'::public.payment_schedule_state,
        'PARTIALLY_REFUNDED'::public.payment_schedule_state,
        'PAID'::public.payment_schedule_state
      ))
    or (old.state = 'PARTIALLY_REFUNDED'::public.payment_schedule_state
      and new.state in (
        'REFUNDED'::public.payment_schedule_state,
        'REFUND_REQUESTED'::public.payment_schedule_state
      ))
  ) then
    raise exception 'PAYMENT_SCHEDULE_INVALID_TRANSITION'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'PAYMENT_SCHEDULE_INVALID_TRANSITION',
          'from_state', old.state,
          'to_state', new.state
        )::text;
  end if;

  if new.state = 'PAID'::public.payment_schedule_state then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.paid_amount is null then
      raise exception 'PAYMENT_SCHEDULE_PAID_AMOUNT_REQUIRED'
        using
          errcode = 'P0001',
          detail = jsonb_build_object('code', 'PAYMENT_SCHEDULE_PAID_AMOUNT_REQUIRED')::text;
    end if;
  end if;

  if new.state = 'FAILED_PERMANENT'::public.payment_schedule_state
    and new.failed_permanently_at is null then
    new.failed_permanently_at := now();
  end if;

  return new;
end;
$$;

comment on function public.payment_schedules_guard_state_transition() is
  'Enforces payment_schedules.state transition matrix, terminal-state exits, and PAID/FAILED_PERMANENT invariants.';

create trigger payment_schedules_guard_state_transition
  before update on public.payment_schedules
  for each row
  execute procedure public.payment_schedules_guard_state_transition();

create trigger payment_schedules_updated_at
  before update on public.payment_schedules
  for each row
  execute procedure public.set_updated_at();

alter table public.payment_schedules enable row level security;

create policy payment_schedules_select_participant_or_admin
  on public.payment_schedules
  for select
  to authenticated
  using (
    (select auth.uid()) in (client_id, provider_id)
    or (select public.is_platform_admin())
  );

revoke all on table public.payment_schedules from public;
revoke all on table public.payment_schedules from anon;

revoke insert, update, delete on table public.payment_schedules from authenticated;

-- Column-level SELECT allowlist: hide fraud metadata, ops internals, card linkage, and
-- cross-participant amounts from direct authenticated reads. Financial history uses §3.13
-- views; fraud fields are written/read by service_role RPCs and Edge Functions only.
revoke select on table public.payment_schedules from authenticated;

grant select (
  id,
  contracted_service_id,
  client_id,
  provider_id,
  gateway_slug,
  installment_number,
  charge_scheduled_at,
  state,
  automatic_attempt_count,
  manual_attempt_count,
  max_attempts,
  upcoming_charge_notified_at,
  is_disputed,
  needs_payment_method_update,
  paid_at,
  failed_at,
  failed_permanently_at,
  cancelled_at,
  refunded_at,
  refunded_amount,
  failure_code,
  failure_reason,
  cancellation_reason,
  created_at,
  updated_at
) on table public.payment_schedules to authenticated;

grant select, insert, update, delete on table public.payment_schedules to service_role;
