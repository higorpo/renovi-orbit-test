-- Payment Task 13: payment_audit_log (design.md §3.9, §11.2).
-- INSERT-only immutable audit trail; SELECT for platform admins and service_role only.

create table public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null
    constraint payment_audit_log_entity_type_check
      check (entity_type in (
        'payment_schedule',
        'client_card_token',
        'provider_gateway_account'
      )),
  entity_id uuid not null,
  service_id uuid references public.contracted_services (id) on delete set null,
  schedule_id uuid references public.payment_schedules (id) on delete set null,
  from_state text,
  to_state text,
  actor public.payment_audit_actor not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.payment_audit_log is
  'Immutable payment lifecycle audit log; INSERT-only via SECURITY DEFINER RPCs.';

comment on column public.payment_audit_log.entity_type is
  'Aggregate kind: payment_schedule, client_card_token, provider_gateway_account.';

create index payment_audit_log_service_id_created_at_idx
  on public.payment_audit_log (service_id, created_at);

create index payment_audit_log_schedule_id_created_at_idx
  on public.payment_audit_log (schedule_id, created_at);

create index payment_audit_log_entity_idx
  on public.payment_audit_log (entity_type, entity_id, created_at desc);

create index payment_audit_log_created_at_brin
  on public.payment_audit_log using brin (created_at);

create trigger payment_audit_log_deny_mutation
  before update or delete on public.payment_audit_log
  for each row
  execute procedure public.payment_deny_row_mutation();

alter table public.payment_audit_log enable row level security;

create policy payment_audit_log_select_admin
  on public.payment_audit_log
  for select
  to authenticated
  using ((select public.is_platform_admin()));

revoke all on table public.payment_audit_log from public;
revoke all on table public.payment_audit_log from anon;

revoke insert, update, delete on table public.payment_audit_log from authenticated;

grant select on table public.payment_audit_log to authenticated;
grant select, insert on table public.payment_audit_log to service_role;

revoke update, delete on table public.payment_audit_log from service_role;

create or replace function public.payment_write_audit(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_service_id uuid default null,
  p_schedule_id uuid default null,
  p_from_state text default null,
  p_to_state text default null,
  p_actor public.payment_audit_actor default 'system',
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_id uuid;
begin
  if p_entity_type not in (
    'payment_schedule',
    'client_card_token',
    'provider_gateway_account'
  ) then
    raise exception 'INVALID_PAYMENT_AUDIT_ENTITY_TYPE'
      using errcode = '22023';
  end if;

  insert into public.payment_audit_log (
    event_type,
    entity_type,
    entity_id,
    service_id,
    schedule_id,
    from_state,
    to_state,
    actor,
    actor_id,
    metadata
  )
  values (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_service_id,
    p_schedule_id,
    p_from_state,
    p_to_state,
    p_actor,
    p_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

comment on function public.payment_write_audit(
  text, text, uuid, uuid, uuid, text, text, public.payment_audit_actor, uuid, jsonb
) is
  'Shared INSERT helper for payment_audit_log; callable from SECURITY DEFINER RPCs.';

revoke all on function public.payment_write_audit(
  text, text, uuid, uuid, uuid, text, text, public.payment_audit_actor, uuid, jsonb
) from public;
revoke all on function public.payment_write_audit(
  text, text, uuid, uuid, uuid, text, text, public.payment_audit_actor, uuid, jsonb
) from anon;
revoke all on function public.payment_write_audit(
  text, text, uuid, uuid, uuid, text, text, public.payment_audit_actor, uuid, jsonb
) from authenticated;

grant execute on function public.payment_write_audit(
  text, text, uuid, uuid, uuid, text, text, public.payment_audit_actor, uuid, jsonb
) to service_role;
