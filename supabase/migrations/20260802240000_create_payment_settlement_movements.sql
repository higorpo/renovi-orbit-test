-- Provider bank settlements: Netcred PayoutPayload movements linked to payment_schedules.
-- Phase 1: table + RLS/CLS + view + upsert/list RPCs (design.md §11.2).

-- Lookup support for settlement upsert join (transaction_id → schedule).
create index if not exists payment_schedules_gateway_transaction_id_idx
  on public.payment_schedules (gateway_transaction_id)
  where gateway_transaction_id is not null;

create table public.payment_settlement_movements (
  id uuid primary key default gen_random_uuid(),
  payment_schedule_id uuid references public.payment_schedules (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  gateway_slug public.payment_gateway_slug not null default 'netcred',
  gateway_payout_id text not null,
  gateway_movement_id text not null,
  gateway_transaction_id text not null,
  payout_status text,
  movement_status text not null,
  movement_type text,
  movement_source text,
  record_type text not null,
  installment smallint
    constraint payment_settlement_movements_installment_check
      check (installment is null or installment between 1 and 48),
  gross_amount numeric(12, 2) not null
    constraint payment_settlement_movements_gross_amount_check
      check (gross_amount >= 0),
  net_amount numeric(12, 2) not null
    constraint payment_settlement_movements_net_amount_check
      check (net_amount >= 0),
  base_settle_date date,
  settling_at date,
  settled_at timestamptz,
  is_advance boolean not null default false,
  is_refund_clawback boolean not null default false,
  brand text,
  bank_account_mask text,
  sync_source text not null default 'webhook'
    constraint payment_settlement_movements_sync_source_check
      check (sync_source in ('webhook', 'graphql_reconcile')),
  raw_snapshot jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_settlement_movements_gateway_movement_unique
    unique (gateway_slug, gateway_movement_id),
  constraint payment_settlement_movements_record_type_check
    check (record_type in ('CREDIT', 'DEBIT')),
  constraint payment_settlement_movements_gateway_ids_nonempty_check
    check (
      length(btrim(gateway_payout_id)) > 0
      and length(btrim(gateway_movement_id)) > 0
      and length(btrim(gateway_transaction_id)) > 0
    )
);

comment on table public.payment_settlement_movements is
  'Netcred payout movements (bank settlement lines) linked to payment_schedules via gateway_transaction_id.';

comment on column public.payment_settlement_movements.payment_schedule_id is
  'FK resolved from movements.transaction_id → payment_schedules.gateway_transaction_id; null only for orphan ops rows (prefer skip).';

comment on column public.payment_settlement_movements.provider_id is
  'Denormalized from payment_schedules for RLS; provider owns the settlement line.';

comment on column public.payment_settlement_movements.gateway_movement_id is
  'Netcred movements.id; UNIQUE with gateway_slug for webhook/reconcile upserts.';

comment on column public.payment_settlement_movements.gateway_transaction_id is
  'Netcred movements.transaction_id; join key to payment_schedules.gateway_transaction_id.';

comment on column public.payment_settlement_movements.is_refund_clawback is
  'True when record_type = DEBIT (refund/chargeback clawback on settlement).';

comment on column public.payment_settlement_movements.bank_account_mask is
  'Masked destination (bank name/compe + last digits). Never store full account number or holder document here.';

comment on column public.payment_settlement_movements.raw_snapshot is
  'Full movement (+ payout refs) for ops/reconcile. service_role only — CLS hides from authenticated.';

comment on column public.payment_settlement_movements.sync_source is
  'Ingestion source: webhook (PAYOUT_*) or graphql_reconcile.';

create index payment_settlement_movements_provider_settling_idx
  on public.payment_settlement_movements (provider_id, settling_at desc nulls last);

create index payment_settlement_movements_schedule_idx
  on public.payment_settlement_movements (payment_schedule_id);

create index payment_settlement_movements_gateway_transaction_idx
  on public.payment_settlement_movements (gateway_transaction_id);

create trigger payment_settlement_movements_updated_at
  before update on public.payment_settlement_movements
  for each row
  execute procedure public.set_updated_at();

alter table public.payment_settlement_movements enable row level security;

create policy payment_settlement_movements_select_provider_or_admin
  on public.payment_settlement_movements
  for select
  to authenticated
  using (
    (select auth.uid()) = provider_id
    or (select public.is_platform_admin())
  );

revoke all on table public.payment_settlement_movements from public;
revoke all on table public.payment_settlement_movements from anon;

revoke insert, update, delete on table public.payment_settlement_movements from authenticated;

-- Column-level SELECT allowlist: hide raw_snapshot (full bank docs live only there).
revoke select on table public.payment_settlement_movements from authenticated;

grant select (
  id,
  payment_schedule_id,
  provider_id,
  gateway_slug,
  gateway_payout_id,
  gateway_movement_id,
  gateway_transaction_id,
  payout_status,
  movement_status,
  movement_type,
  movement_source,
  record_type,
  installment,
  gross_amount,
  net_amount,
  base_settle_date,
  settling_at,
  settled_at,
  is_advance,
  is_refund_clawback,
  brand,
  bank_account_mask,
  sync_source,
  synced_at,
  created_at,
  updated_at
) on table public.payment_settlement_movements to authenticated;

grant select, insert, update, delete on table public.payment_settlement_movements to service_role;

-- Provider UI read model: same CLS surface, tenancy via invoker RLS on base table.
create view public.provider_settlement_movements_v
with (security_invoker = true) as
select
  psm.id,
  psm.payment_schedule_id,
  psm.provider_id,
  psm.gateway_slug,
  psm.gateway_payout_id,
  psm.gateway_movement_id,
  psm.gateway_transaction_id,
  psm.payout_status,
  psm.movement_status,
  psm.movement_type,
  psm.movement_source,
  psm.record_type,
  psm.installment,
  psm.gross_amount,
  psm.net_amount,
  psm.base_settle_date,
  psm.settling_at,
  psm.settled_at,
  psm.is_advance,
  psm.is_refund_clawback,
  psm.brand,
  psm.bank_account_mask,
  psm.sync_source,
  psm.synced_at,
  psm.created_at,
  psm.updated_at,
  cs.service_request_id,
  coalesce(nullif(btrim(sr.title), ''), null) as service_request_title
from public.payment_settlement_movements psm
left join public.payment_schedules ps
  on ps.id = psm.payment_schedule_id
left join public.contracted_services cs
  on cs.id = ps.contracted_service_id
left join public.service_requests sr
  on sr.id = cs.service_request_id;

comment on view public.provider_settlement_movements_v is
  'Provider settlement (bank liquidation) lines for Ganhos UI. Includes service_request id/title for navigation. No raw_snapshot; RLS via security_invoker.';

revoke all on public.provider_settlement_movements_v from public;
revoke all on public.provider_settlement_movements_v from anon;
grant select on public.provider_settlement_movements_v to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert (service_role): webhook PAYOUT_* / GraphQL reconcile
-- ---------------------------------------------------------------------------

create or replace function public.payment_upsert_settlement_movements(
  p_movements jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
  v_upserted int := 0;
  v_skipped_platform int := 0;
  v_skipped_not_found int := 0;
  v_skipped_invalid int := 0;

  v_gateway_slug public.payment_gateway_slug;
  v_gateway_payout_id text;
  v_gateway_movement_id text;
  v_gateway_transaction_id text;
  v_holder_company_id text;
  v_record_type text;
  v_sync_source text;

  v_schedule_id uuid;
  v_provider_id uuid;
  v_provider_company_id text;
  v_row_id uuid;
  v_is_clawback boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_upsert_settlement_movements'
      using errcode = '42501';
  end if;

  if p_movements is null or jsonb_typeof(p_movements) <> 'array' then
    raise exception 'SETTLEMENT_MOVEMENTS_INVALID'
      using
        errcode = '22023',
        detail = jsonb_build_object('code', 'SETTLEMENT_MOVEMENTS_INVALID')::text;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_movements)
  loop
    v_gateway_movement_id := nullif(btrim(coalesce(v_item->>'gateway_movement_id', '')), '');
    v_gateway_transaction_id := nullif(btrim(coalesce(v_item->>'gateway_transaction_id', '')), '');
    v_gateway_payout_id := nullif(btrim(coalesce(v_item->>'gateway_payout_id', '')), '');
    v_holder_company_id := nullif(btrim(coalesce(
      v_item->>'holder_company_id',
      v_item->>'company_id',
      ''
    )), '');
    v_record_type := upper(nullif(btrim(coalesce(v_item->>'record_type', '')), ''));
    v_sync_source := coalesce(nullif(btrim(v_item->>'sync_source'), ''), 'webhook');

    begin
      v_gateway_slug := coalesce(
        nullif(btrim(v_item->>'gateway_slug'), '')::public.payment_gateway_slug,
        'netcred'::public.payment_gateway_slug
      );
    exception
      when invalid_text_representation then
        v_gateway_slug := 'netcred'::public.payment_gateway_slug;
    end;

    if v_gateway_movement_id is null
      or v_gateway_transaction_id is null
      or v_gateway_payout_id is null
      or v_record_type is null
      or v_record_type not in ('CREDIT', 'DEBIT')
      or v_sync_source not in ('webhook', 'graphql_reconcile')
      or nullif(btrim(coalesce(v_item->>'movement_status', '')), '') is null
      or v_item->>'gross_amount' is null
      or v_item->>'net_amount' is null
    then
      v_skipped_invalid := v_skipped_invalid + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'gateway_movement_id', v_gateway_movement_id,
          'outcome', 'skipped_invalid'
        )
      );
      continue;
    end if;

    select ps.id, ps.provider_id
    into v_schedule_id, v_provider_id
    from public.payment_schedules ps
    where ps.gateway_transaction_id = v_gateway_transaction_id
      and ps.gateway_slug = v_gateway_slug
    order by ps.updated_at desc nulls last, ps.created_at desc
    limit 1;

    if v_schedule_id is null then
      v_skipped_not_found := v_skipped_not_found + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'gateway_movement_id', v_gateway_movement_id,
          'gateway_transaction_id', v_gateway_transaction_id,
          'outcome', 'skipped_not_found'
        )
      );
      continue;
    end if;

    select nullif(btrim(pga.netcred_company_id), '')
    into v_provider_company_id
    from public.provider_gateway_accounts pga
    where pga.provider_id = v_provider_id
      and pga.gateway_slug = v_gateway_slug;

    -- Persist only the provider split leg; skip platform / unmatched company.
    if v_holder_company_id is null
      or v_provider_company_id is null
      or v_holder_company_id is distinct from v_provider_company_id
    then
      v_skipped_platform := v_skipped_platform + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'gateway_movement_id', v_gateway_movement_id,
          'gateway_transaction_id', v_gateway_transaction_id,
          'holder_company_id', v_holder_company_id,
          'outcome', 'skipped_platform'
        )
      );
      continue;
    end if;

    v_is_clawback := (v_record_type = 'DEBIT')
      or coalesce((v_item->>'is_refund_clawback')::boolean, false);

    insert into public.payment_settlement_movements (
      payment_schedule_id,
      provider_id,
      gateway_slug,
      gateway_payout_id,
      gateway_movement_id,
      gateway_transaction_id,
      payout_status,
      movement_status,
      movement_type,
      movement_source,
      record_type,
      installment,
      gross_amount,
      net_amount,
      base_settle_date,
      settling_at,
      settled_at,
      is_advance,
      is_refund_clawback,
      brand,
      bank_account_mask,
      sync_source,
      raw_snapshot,
      synced_at
    )
    values (
      v_schedule_id,
      v_provider_id,
      v_gateway_slug,
      v_gateway_payout_id,
      v_gateway_movement_id,
      v_gateway_transaction_id,
      nullif(btrim(coalesce(v_item->>'payout_status', '')), ''),
      btrim(v_item->>'movement_status'),
      nullif(btrim(coalesce(v_item->>'movement_type', '')), ''),
      nullif(btrim(coalesce(v_item->>'movement_source', '')), ''),
      v_record_type,
      nullif(v_item->>'installment', '')::smallint,
      (v_item->>'gross_amount')::numeric(12, 2),
      (v_item->>'net_amount')::numeric(12, 2),
      nullif(v_item->>'base_settle_date', '')::date,
      nullif(v_item->>'settling_at', '')::date,
      nullif(v_item->>'settled_at', '')::timestamptz,
      coalesce((v_item->>'is_advance')::boolean, false),
      v_is_clawback,
      nullif(btrim(coalesce(v_item->>'brand', '')), ''),
      nullif(btrim(coalesce(v_item->>'bank_account_mask', '')), ''),
      v_sync_source,
      coalesce(v_item->'raw_snapshot', v_item, '{}'::jsonb),
      now()
    )
    on conflict (gateway_slug, gateway_movement_id) do update
    set
      payment_schedule_id = excluded.payment_schedule_id,
      provider_id = excluded.provider_id,
      gateway_payout_id = excluded.gateway_payout_id,
      gateway_transaction_id = excluded.gateway_transaction_id,
      payout_status = excluded.payout_status,
      movement_status = excluded.movement_status,
      movement_type = excluded.movement_type,
      movement_source = excluded.movement_source,
      record_type = excluded.record_type,
      installment = excluded.installment,
      gross_amount = excluded.gross_amount,
      net_amount = excluded.net_amount,
      base_settle_date = excluded.base_settle_date,
      settling_at = excluded.settling_at,
      settled_at = excluded.settled_at,
      is_advance = excluded.is_advance,
      is_refund_clawback = excluded.is_refund_clawback,
      brand = excluded.brand,
      bank_account_mask = excluded.bank_account_mask,
      sync_source = excluded.sync_source,
      raw_snapshot = excluded.raw_snapshot,
      synced_at = excluded.synced_at
    returning id into v_row_id;

    v_upserted := v_upserted + 1;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'gateway_movement_id', v_gateway_movement_id,
        'gateway_transaction_id', v_gateway_transaction_id,
        'payment_schedule_id', v_schedule_id,
        'provider_id', v_provider_id,
        'id', v_row_id,
        'outcome', 'upserted'
      )
    );
  end loop;

  return jsonb_build_object(
    'upserted', v_upserted,
    'skipped_platform', v_skipped_platform,
    'skipped_not_found', v_skipped_not_found,
    'skipped_invalid', v_skipped_invalid,
    'results', v_results
  );
end;
$$;

comment on function public.payment_upsert_settlement_movements(jsonb) is
  'Upserts Netcred settlement movements for webhook/reconcile. Filters to provider holder_company via provider_gateway_accounts.netcred_company_id. service_role only.';

revoke all on function public.payment_upsert_settlement_movements(jsonb) from public;
revoke all on function public.payment_upsert_settlement_movements(jsonb) from anon;
revoke all on function public.payment_upsert_settlement_movements(jsonb) from authenticated;
grant execute on function public.payment_upsert_settlement_movements(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Paginated list (authenticated provider)
-- ---------------------------------------------------------------------------

create or replace function public.list_provider_settlement_movements(
  p_page integer default 1,
  p_page_size integer default 20,
  p_movement_status text default null,
  p_record_type text default null,
  p_settling_from date default null,
  p_settling_to date default null,
  p_settled_from timestamptz default null,
  p_settled_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := greatest(least(coalesce(p_page_size, 20), 100), 1);
  v_offset integer;
  v_total bigint;
  v_items jsonb;
  v_status text := nullif(btrim(upper(coalesce(p_movement_status, ''))), '');
  v_record text := nullif(btrim(upper(coalesce(p_record_type, ''))), '');
begin
  if v_actor is null then
    raise exception 'Authentication required for list_provider_settlement_movements'
      using errcode = '42501';
  end if;

  if v_record is not null and v_record not in ('CREDIT', 'DEBIT') then
    raise exception 'SETTLEMENT_RECORD_TYPE_INVALID'
      using
        errcode = '22023',
        detail = jsonb_build_object('code', 'SETTLEMENT_RECORD_TYPE_INVALID')::text;
  end if;

  v_offset := (v_page - 1) * v_page_size;

  select count(*)::bigint
  into v_total
  from public.payment_settlement_movements psm
  where psm.provider_id = v_actor
    and (v_status is null or psm.movement_status = v_status)
    and (v_record is null or psm.record_type = v_record)
    and (p_settling_from is null or psm.settling_at >= p_settling_from)
    and (p_settling_to is null or psm.settling_at <= p_settling_to)
    and (p_settled_from is null or psm.settled_at >= p_settled_from)
    and (p_settled_to is null or psm.settled_at <= p_settled_to)
    -- CREDIT tabs (Todos/Previsto/Liquidado): only amounts the provider is still expected to receive.
    and (
      v_record is distinct from 'CREDIT'
      or (
        (
          psm.payment_schedule_id is null
          or exists (
            select 1
            from public.payment_schedules ps
            where ps.id = psm.payment_schedule_id
              and ps.state not in (
                'REFUNDED'::public.payment_schedule_state,
                'REFUND_REQUESTED'::public.payment_schedule_state
              )
          )
        )
        and coalesce(
          (
            select sum(d.net_amount)
            from public.payment_settlement_movements d
            where d.provider_id = psm.provider_id
              and d.record_type = 'DEBIT'
              and d.payment_schedule_id is not distinct from psm.payment_schedule_id
              and d.installment is not distinct from psm.installment
          ),
          0
        ) < psm.net_amount
      )
    );

  select coalesce(
    jsonb_agg(row_to_json(x)::jsonb order by x.settling_at desc nulls last, x.created_at desc),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      psm.id,
      psm.payment_schedule_id,
      psm.provider_id,
      psm.gateway_slug,
      psm.gateway_payout_id,
      psm.gateway_movement_id,
      psm.gateway_transaction_id,
      psm.payout_status,
      psm.movement_status,
      psm.movement_type,
      psm.movement_source,
      psm.record_type,
      psm.installment,
      psm.gross_amount,
      psm.net_amount,
      psm.base_settle_date,
      psm.settling_at,
      psm.settled_at,
      psm.is_advance,
      psm.is_refund_clawback,
      psm.brand,
      psm.bank_account_mask,
      psm.sync_source,
      psm.synced_at,
      psm.created_at,
      psm.updated_at,
      cs.service_request_id,
      coalesce(nullif(btrim(sr.title), ''), null) as service_request_title
    from public.payment_settlement_movements psm
    left join public.payment_schedules ps
      on ps.id = psm.payment_schedule_id
    left join public.contracted_services cs
      on cs.id = ps.contracted_service_id
    left join public.service_requests sr
      on sr.id = cs.service_request_id
    where psm.provider_id = v_actor
      and (v_status is null or psm.movement_status = v_status)
      and (v_record is null or psm.record_type = v_record)
      and (p_settling_from is null or psm.settling_at >= p_settling_from)
      and (p_settling_to is null or psm.settling_at <= p_settling_to)
      and (p_settled_from is null or psm.settled_at >= p_settled_from)
      and (p_settled_to is null or psm.settled_at <= p_settled_to)
      and (
        v_record is distinct from 'CREDIT'
        or (
          (
            psm.payment_schedule_id is null
            or exists (
              select 1
              from public.payment_schedules ps_recv
              where ps_recv.id = psm.payment_schedule_id
                and ps_recv.state not in (
                  'REFUNDED'::public.payment_schedule_state,
                  'REFUND_REQUESTED'::public.payment_schedule_state
                )
            )
          )
          and coalesce(
            (
              select sum(d.net_amount)
              from public.payment_settlement_movements d
              where d.provider_id = psm.provider_id
                and d.record_type = 'DEBIT'
                and d.payment_schedule_id is not distinct from psm.payment_schedule_id
                and d.installment is not distinct from psm.installment
            ),
            0
          ) < psm.net_amount
        )
      )
    order by psm.settling_at desc nulls last, psm.created_at desc
    offset v_offset
    limit v_page_size
  ) x;

  return jsonb_build_object(
    'items', v_items,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

comment on function public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamptz, timestamptz) is
  'Paginated settlement movements for the authenticated provider (Ganhos). Filters: movement_status, record_type, settling/settled date ranges. CREDIT excludes refunded schedules and fully clawed-back installments. Includes service_request_id/title for navigation.';

revoke all on function public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamptz, timestamptz) from public;
revoke all on function public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamptz, timestamptz) from anon;
grant execute on function public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamptz, timestamptz) to authenticated;
grant execute on function public.list_provider_settlement_movements(integer, integer, text, text, date, date, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Webhook handler: PAYOUT_CREATE / PAYOUT_SETTLE → upsert settlement movements
-- ---------------------------------------------------------------------------

create or replace function public.payment_webhook_payout_bank_account_mask(
  p_bank_account jsonb
)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  v_bank_label text;
  v_number text;
  v_last text;
begin
  if p_bank_account is null or jsonb_typeof(p_bank_account) <> 'object' then
    return null;
  end if;

  v_bank_label := nullif(btrim(coalesce(
    p_bank_account #>> '{bank,name}',
    p_bank_account #>> '{bank,compe}',
    ''
  )), '');
  v_number := nullif(btrim(coalesce(p_bank_account->>'number', '')), '');

  if v_number is not null then
    v_last := right(v_number, least(4, length(v_number)));
  end if;

  if v_bank_label is not null and v_last is not null then
    return v_bank_label || ' ****' || v_last;
  end if;
  if v_bank_label is not null then
    return v_bank_label;
  end if;
  if v_last is not null then
    return '****' || v_last;
  end if;
  return null;
end;
$$;

comment on function public.payment_webhook_payout_bank_account_mask(jsonb) is
  'Builds CLS-safe bank_account_mask from PayoutPayload.bank_account (name/compe + last digits).';

create or replace function public.payment_webhook_handle_payout(
  p_webhook_event_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout_id text;
  v_payout_status text;
  v_brand text;
  v_is_advance boolean;
  v_bank_mask text;
  v_movements jsonb;
  v_movement jsonb;
  v_upsert_items jsonb := '[]'::jsonb;
  v_upsert_result jsonb;
  v_movement_status text;
  v_movement_type text;
  v_movement_source text;
  v_record_type text;
  v_movement_id text;
  v_transaction_id text;
  v_holder_company_id text;
  v_company_id text;
  v_gross text;
  v_net text;
  v_known_status text[] := array['PENDING', 'PAID_OUT'];
  v_known_source text[] := array[
    'TRANSACTION', 'REFUND', 'DISPUTE', 'LEASE', 'ADVANCE',
    'PERIODIC_FEE', 'MANUAL', 'NEGATIVE_BALANCE', 'OTHER'
  ];
  v_known_record text[] := array['CREDIT', 'DEBIT'];
  v_known_type text[] := array[
    'CARD_PAYMENT', 'PIX_PAYMENT', 'BILLET_PAYMENT', 'REFUND',
    'LEASE', 'PERIODIC_FEE', 'ADJUSTMENT', 'CHARGEBACK'
  ];
  v_known_payout_status text[] := array[
    'PENDING', 'APPROVED', 'IN_QUEUE', 'PROCESSING', 'FAILED', 'PAID_OUT'
  ];
  v_upserted int;
  v_skipped_not_found int;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object(
      'outcome', 'noop',
      'reason', 'invalid_payload',
      'webhook_event_id', p_webhook_event_id
    );
  end if;

  v_payout_id := nullif(btrim(coalesce(p_payload->>'id', '')), '');
  if v_payout_id is null then
    return jsonb_build_object(
      'outcome', 'noop',
      'reason', 'missing_payout_id',
      'webhook_event_id', p_webhook_event_id
    );
  end if;

  v_payout_status := upper(nullif(btrim(coalesce(p_payload->>'payout_status', '')), ''));
  if v_payout_status is not null and not (v_payout_status = any (v_known_payout_status)) then
    raise log 'payment_webhook_handle_payout: unknown payout_status % (event %)',
      v_payout_status, p_webhook_event_id;
  end if;

  v_brand := nullif(btrim(coalesce(p_payload->>'brand', '')), '');
  v_is_advance := coalesce((p_payload->>'is_advance')::boolean, false);
  v_bank_mask := public.payment_webhook_payout_bank_account_mask(p_payload->'bank_account');

  v_movements := p_payload->'movements';
  if v_movements is null or jsonb_typeof(v_movements) <> 'array' or jsonb_array_length(v_movements) = 0 then
    return jsonb_build_object(
      'outcome', 'noop',
      'reason', 'empty_movements',
      'gateway_payout_id', v_payout_id,
      'webhook_event_id', p_webhook_event_id
    );
  end if;

  for v_movement in
    select value
    from jsonb_array_elements(v_movements)
  loop
    if jsonb_typeof(v_movement) <> 'object' then
      continue;
    end if;

    v_movement_id := nullif(btrim(coalesce(v_movement->>'id', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_movement->>'transaction_id', '')), '');
    v_movement_status := upper(nullif(btrim(coalesce(v_movement->>'movement_status', '')), ''));
    v_movement_type := upper(nullif(btrim(coalesce(v_movement->>'movement_type', '')), ''));
    v_movement_source := upper(nullif(btrim(coalesce(v_movement->>'movement_source', '')), ''));
    v_record_type := upper(nullif(btrim(coalesce(v_movement->>'record_type', '')), ''));
    v_company_id := nullif(btrim(coalesce(v_movement->>'company_id', '')), '');
    v_holder_company_id := nullif(btrim(coalesce(
      v_movement->>'holder_company_id',
      v_movement->>'company_id',
      ''
    )), '');
    v_gross := nullif(btrim(coalesce(v_movement->>'amount', '')), '');
    v_net := nullif(btrim(coalesce(v_movement->>'net_amount', '')), '');

    -- Unknown enums: log + still attempt upsert (API may evolve).
    if v_movement_status is not null and not (v_movement_status = any (v_known_status)) then
      raise log 'payment_webhook_handle_payout: unknown movement_status % (event % movement %)',
        v_movement_status, p_webhook_event_id, v_movement_id;
    end if;
    if v_movement_source is not null and not (v_movement_source = any (v_known_source)) then
      raise log 'payment_webhook_handle_payout: unknown movement_source % (event % movement %)',
        v_movement_source, p_webhook_event_id, v_movement_id;
    end if;
    if v_record_type is not null and not (v_record_type = any (v_known_record)) then
      raise log 'payment_webhook_handle_payout: unknown record_type % (event % movement %)',
        v_record_type, p_webhook_event_id, v_movement_id;
    end if;
    if v_movement_type is not null and not (v_movement_type = any (v_known_type)) then
      raise log 'payment_webhook_handle_payout: unknown movement_type % (event % movement %)',
        v_movement_type, p_webhook_event_id, v_movement_id;
    end if;

    if v_movement_id is null
      or v_transaction_id is null
      or v_movement_status is null
      or v_record_type is null
      or v_record_type not in ('CREDIT', 'DEBIT')
      or v_gross is null
      or v_net is null
    then
      continue;
    end if;

    v_upsert_items := v_upsert_items || jsonb_build_array(
      jsonb_build_object(
        'gateway_slug', 'netcred',
        'gateway_payout_id', v_payout_id,
        'gateway_movement_id', v_movement_id,
        'gateway_transaction_id', v_transaction_id,
        'holder_company_id', v_holder_company_id,
        'company_id', v_company_id,
        'payout_status', v_payout_status,
        'movement_status', v_movement_status,
        'movement_type', v_movement_type,
        'movement_source', v_movement_source,
        'record_type', v_record_type,
        'installment', nullif(v_movement->>'installment', ''),
        'gross_amount', v_gross,
        'net_amount', v_net,
        'base_settle_date', nullif(btrim(coalesce(v_movement->>'base_settle_date', '')), ''),
        'settling_at', nullif(btrim(coalesce(v_movement->>'settling_at', '')), ''),
        'settled_at', nullif(btrim(coalesce(v_movement->>'settled_at', '')), ''),
        'is_advance', v_is_advance,
        'is_refund_clawback', (v_record_type = 'DEBIT'),
        'brand', v_brand,
        'bank_account_mask', v_bank_mask,
        'sync_source', 'webhook',
        'raw_snapshot', jsonb_build_object(
          'payout_id', v_payout_id,
          'payout_status', v_payout_status,
          'movement', v_movement
        )
      )
    );
  end loop;

  if jsonb_array_length(v_upsert_items) = 0 then
    return jsonb_build_object(
      'outcome', 'noop',
      'reason', 'no_valid_movements',
      'gateway_payout_id', v_payout_id,
      'webhook_event_id', p_webhook_event_id
    );
  end if;

  v_upsert_result := public.payment_upsert_settlement_movements(v_upsert_items);
  v_upserted := coalesce((v_upsert_result->>'upserted')::int, 0);
  v_skipped_not_found := coalesce((v_upsert_result->>'skipped_not_found')::int, 0);

  -- Schedules may not have gateway_transaction_id yet — retry via webhook queue.
  if v_skipped_not_found > 0 then
    return jsonb_build_object(
      'outcome', 'not_found',
      'reason', 'schedule_not_found_for_transaction',
      'gateway_payout_id', v_payout_id,
      'webhook_event_id', p_webhook_event_id,
      'upsert', v_upsert_result
    );
  end if;

  if v_upserted > 0 then
    return jsonb_build_object(
      'outcome', 'upserted',
      'gateway_payout_id', v_payout_id,
      'webhook_event_id', p_webhook_event_id,
      'upsert', v_upsert_result
    );
  end if;

  -- Platform-only / invalid-only batches: terminal success (no retry storm).
  return jsonb_build_object(
    'outcome', 'noop',
    'reason', 'all_filtered',
    'gateway_payout_id', v_payout_id,
    'webhook_event_id', p_webhook_event_id,
    'upsert', v_upsert_result
  );
end;
$$;

comment on function public.payment_webhook_handle_payout(uuid, jsonb) is
  'PAYOUT_CREATE/PAYOUT_SETTLE: maps PayoutPayload.movements[] and calls payment_upsert_settlement_movements. not_found → retry.';

revoke all on function public.payment_webhook_payout_bank_account_mask(jsonb) from public;
revoke all on function public.payment_webhook_payout_bank_account_mask(jsonb) from anon;
revoke all on function public.payment_webhook_payout_bank_account_mask(jsonb) from authenticated;
revoke all on function public.payment_webhook_payout_bank_account_mask(jsonb) from service_role;

revoke all on function public.payment_webhook_handle_payout(uuid, jsonb) from public;
revoke all on function public.payment_webhook_handle_payout(uuid, jsonb) from anon;
revoke all on function public.payment_webhook_handle_payout(uuid, jsonb) from authenticated;
revoke all on function public.payment_webhook_handle_payout(uuid, jsonb) from service_role;
