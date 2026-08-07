-- Service completion: client execution declaration audit trail (checkbox ack).
-- One row per contracted_service; mutations via SECURITY DEFINER RPC only.
-- IP / device / geo readable by service_role only (no authenticated SELECT).

create table public.service_completion_execution_declarations (
  id uuid primary key default gen_random_uuid(),
  contracted_service_id uuid not null
    references public.contracted_services (id) on delete cascade,
  service_request_id uuid not null
    references public.service_requests (id) on delete cascade,
  client_id uuid not null
    references public.profiles (id) on delete cascade,
  declared_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  client_ip text,
  ip_geo jsonb,
  device_id text,
  platform text,
  operating_system text,
  os_version text,
  manufacturer text,
  model text,
  device_name text,
  is_virtual boolean,
  web_view_version text,
  user_agent text,
  client_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_completion_execution_declarations_cs_unique
    unique (contracted_service_id)
);

comment on table public.service_completion_execution_declarations is
  'Auditable client execution declaration (checkbox). One row per CS; declared_at immutable on upsert.';

comment on column public.service_completion_execution_declarations.declared_at is
  'First declaration timestamp; never overwritten on re-upsert.';

comment on column public.service_completion_execution_declarations.last_seen_at is
  'Most recent declaration upsert (metadata refresh).';

comment on column public.service_completion_execution_declarations.ip_geo is
  'Approximate location from IP lookup on Edge (country/region/city); null when lookup fails.';

create index service_completion_execution_declarations_client_id_idx
  on public.service_completion_execution_declarations (client_id);

create index service_completion_execution_declarations_sr_id_idx
  on public.service_completion_execution_declarations (service_request_id);

create trigger service_completion_execution_declarations_updated_at
  before update on public.service_completion_execution_declarations
  for each row
  execute procedure public.set_updated_at();

alter table public.service_completion_execution_declarations enable row level security;

revoke all on table public.service_completion_execution_declarations from public, anon;
revoke all on table public.service_completion_execution_declarations from authenticated;

grant select, insert, update, delete
  on table public.service_completion_execution_declarations
  to service_role;

-- No authenticated policies: deny-by-default. Reads for ops via service_role only.

create or replace function public.service_completion_upsert_execution_declaration(
  p_contracted_service_id uuid,
  p_client_ip text default null,
  p_ip_geo jsonb default null,
  p_device_id text default null,
  p_platform text default null,
  p_operating_system text default null,
  p_os_version text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_device_name text default null,
  p_is_virtual boolean default null,
  p_web_view_version text default null,
  p_user_agent text default null,
  p_client_timezone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_id uuid;
  v_declared_at timestamptz;
  v_last_seen_at timestamptz := now();
begin
  if v_client_id is null then
    raise exception 'Authentication required for service_completion_upsert_execution_declaration'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.client_id = v_client_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  if v_cs.status is distinct from 'EXECUTED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  insert into public.service_completion_execution_declarations (
    contracted_service_id,
    service_request_id,
    client_id,
    declared_at,
    last_seen_at,
    client_ip,
    ip_geo,
    device_id,
    platform,
    operating_system,
    os_version,
    manufacturer,
    model,
    device_name,
    is_virtual,
    web_view_version,
    user_agent,
    client_timezone
  )
  values (
    p_contracted_service_id,
    v_cs.service_request_id,
    v_client_id,
    v_last_seen_at,
    v_last_seen_at,
    nullif(btrim(p_client_ip), ''),
    p_ip_geo,
    nullif(btrim(p_device_id), ''),
    nullif(btrim(p_platform), ''),
    nullif(btrim(p_operating_system), ''),
    nullif(btrim(p_os_version), ''),
    nullif(btrim(p_manufacturer), ''),
    nullif(btrim(p_model), ''),
    nullif(btrim(p_device_name), ''),
    p_is_virtual,
    nullif(btrim(p_web_view_version), ''),
    nullif(btrim(p_user_agent), ''),
    nullif(btrim(p_client_timezone), '')
  )
  on conflict (contracted_service_id) do update set
    last_seen_at = excluded.last_seen_at,
    client_ip = excluded.client_ip,
    ip_geo = excluded.ip_geo,
    device_id = excluded.device_id,
    platform = excluded.platform,
    operating_system = excluded.operating_system,
    os_version = excluded.os_version,
    manufacturer = excluded.manufacturer,
    model = excluded.model,
    device_name = excluded.device_name,
    is_virtual = excluded.is_virtual,
    web_view_version = excluded.web_view_version,
    user_agent = excluded.user_agent,
    client_timezone = excluded.client_timezone
    -- declared_at intentionally omitted (immutable)
  returning id, declared_at into v_id, v_declared_at;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'contracted_service_id', p_contracted_service_id,
    'declared_at', v_declared_at,
    'last_seen_at', v_last_seen_at
  );
end;
$$;

comment on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) is
  'Client upserts execution declaration metadata for an EXECUTED CS; preserves declared_at on conflict.';

revoke all on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) from public;
revoke all on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) from anon;

grant execute on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) to authenticated;
grant execute on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) to service_role;
grant execute on function public.service_completion_upsert_execution_declaration(
  uuid, text, jsonb, text, text, text, text, text, text, text, boolean, text, text, text
) to postgres;
