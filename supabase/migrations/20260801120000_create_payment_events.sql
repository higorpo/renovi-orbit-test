-- Payment Task 14: payment_events (design.md §3.10, §11.2).
-- Append-only domain event log; SELECT for platform admins and service_role only.

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null
    constraint payment_events_aggregate_type_check
      check (aggregate_type in (
        'payment_schedule',
        'client_card_token',
        'provider_gateway_account'
      )),
  aggregate_id uuid not null,
  service_id uuid references public.contracted_services (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.payment_events is
  'Domain event log for payment aggregates; analytics backbone; INSERT-only via RPCs.';

comment on column public.payment_events.aggregate_type is
  'Aggregate kind: payment_schedule, client_card_token, provider_gateway_account.';

create index payment_events_event_type_created_at_idx
  on public.payment_events (event_type, created_at);

create index payment_events_service_id_created_at_idx
  on public.payment_events (service_id, created_at);

create index payment_events_aggregate_created_at_idx
  on public.payment_events (aggregate_type, aggregate_id, created_at);

create index payment_events_created_at_brin
  on public.payment_events using brin (created_at);

create trigger payment_events_deny_mutation
  before update or delete on public.payment_events
  for each row
  execute procedure public.payment_deny_row_mutation();

alter table public.payment_events enable row level security;

create policy payment_events_select_admin
  on public.payment_events
  for select
  to authenticated
  using ((select public.is_platform_admin()));

revoke all on table public.payment_events from public;
revoke all on table public.payment_events from anon;

revoke insert, update, delete on table public.payment_events from authenticated;

grant select on table public.payment_events to authenticated;
grant select, insert on table public.payment_events to service_role;

revoke update, delete on table public.payment_events from service_role;

create or replace function public.payment_write_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_service_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_aggregate_type not in (
    'payment_schedule',
    'client_card_token',
    'provider_gateway_account'
  ) then
    raise exception 'INVALID_PAYMENT_EVENT_AGGREGATE_TYPE'
      using errcode = '22023';
  end if;

  insert into public.payment_events (
    event_type,
    aggregate_type,
    aggregate_id,
    service_id,
    payload
  )
  values (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_service_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

comment on function public.payment_write_event(text, text, uuid, uuid, jsonb) is
  'Shared INSERT helper for payment_events; callable from SECURITY DEFINER RPCs.';

revoke all on function public.payment_write_event(text, text, uuid, uuid, jsonb) from public;
revoke all on function public.payment_write_event(text, text, uuid, uuid, jsonb) from anon;
revoke all on function public.payment_write_event(text, text, uuid, uuid, jsonb) from authenticated;

grant execute on function public.payment_write_event(text, text, uuid, uuid, jsonb) to service_role;
