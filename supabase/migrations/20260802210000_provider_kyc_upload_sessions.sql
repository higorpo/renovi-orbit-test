-- Provider KYC Option A: upload sessions for orphan document tracking (mirror chat_media).
-- Path layout unchanged: providers/{provider_id}/kyc/{document_key}/{filename}

create table public.provider_kyc_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'expired')),
  document_key text not null,
  storage_path text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_kyc_upload_sessions_document_key_check
    check (public.payment_provider_kyc_document_key_valid(document_key))
);

comment on table public.provider_kyc_upload_sessions is
  'Tracks pending KYC Storage uploads until payment_submit_provider_kyc links them; orphan janitor expires leftovers.';

comment on column public.provider_kyc_upload_sessions.status is
  'pending until KYC submit links the path; linked on submit; expired after janitor TTL.';

comment on column public.provider_kyc_upload_sessions.document_key is
  'Allowlisted key: identity | address-proof | corporate-charter | legal-rep-id.';

comment on column public.provider_kyc_upload_sessions.storage_path is
  'Object path in provider-kyc-documents; set after upload via register RPC.';

comment on column public.provider_kyc_upload_sessions.expires_at is
  'Session TTL (default 24h); janitor targets pending rows past expires_at + 24h retention.';

create index provider_kyc_upload_sessions_provider_id_idx
  on public.provider_kyc_upload_sessions (provider_id);

create index provider_kyc_upload_sessions_orphan_janitor_idx
  on public.provider_kyc_upload_sessions (expires_at)
  where status = 'pending';

comment on index public.provider_kyc_upload_sessions_orphan_janitor_idx is
  'Supports payment_janitor_orphan_kyc_documents: pending sessions past retention window.';

alter table public.provider_kyc_upload_sessions enable row level security;

revoke all on table public.provider_kyc_upload_sessions from public;
revoke all on table public.provider_kyc_upload_sessions from anon;

grant select, insert on table public.provider_kyc_upload_sessions to authenticated;
grant select, insert, update, delete on table public.provider_kyc_upload_sessions to service_role;

create policy provider_kyc_upload_sessions_select
  on public.provider_kyc_upload_sessions
  for select
  to authenticated
  using ((select auth.uid()) = provider_id);

create policy provider_kyc_upload_sessions_insert
  on public.provider_kyc_upload_sessions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = provider_id
    and exists (
      select 1
      from public.profiles p
      where p.id = provider_id
        and p.role = 'provider'
    )
  );

comment on policy provider_kyc_upload_sessions_select on public.provider_kyc_upload_sessions is
  'Provider may read own KYC upload sessions.';

comment on policy provider_kyc_upload_sessions_insert on public.provider_kyc_upload_sessions is
  'Provider may insert own pending KYC upload sessions; linked/expired only via SECURITY DEFINER RPCs.';

create or replace function public.payment_create_provider_kyc_upload_session(
  p_document_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := auth.uid();
  v_key text := trim(coalesce(p_document_key, ''));
  v_session public.provider_kyc_upload_sessions%rowtype;
  v_path_prefix text;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for payment_create_provider_kyc_upload_session'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_provider_id
      and p.role = 'provider'
  ) then
    raise exception 'PROVIDER_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  if not public.payment_provider_kyc_document_key_valid(v_key) then
    raise exception 'KYC_DOCUMENT_KEY_INVALID'
      using errcode = '22023';
  end if;

  if not public.payment_provider_kyc_storage_mutations_allowed() then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  v_path_prefix := format('providers/%s/kyc/%s/', v_provider_id, v_key);

  insert into public.provider_kyc_upload_sessions (
    provider_id,
    status,
    document_key,
    expires_at
  )
  values (
    v_provider_id,
    'pending',
    v_key,
    now() + interval '24 hours'
  )
  returning * into v_session;

  return jsonb_build_object(
    'upload_session_id', v_session.id,
    'document_key', v_session.document_key,
    'status', v_session.status,
    'expires_at', v_session.expires_at,
    'storage_path_prefix', v_path_prefix
  );
end;
$$;

comment on function public.payment_create_provider_kyc_upload_session(text) is
  'Creates a pending KYC upload session for the authenticated provider; returns expected storage path prefix.';

revoke all on function public.payment_create_provider_kyc_upload_session(text) from public;
revoke all on function public.payment_create_provider_kyc_upload_session(text) from anon;
revoke all on function public.payment_create_provider_kyc_upload_session(text) from service_role;

grant execute on function public.payment_create_provider_kyc_upload_session(text) to authenticated;

create or replace function public.payment_register_provider_kyc_upload_path(
  p_upload_session_id uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_provider_id uuid := auth.uid();
  v_session public.provider_kyc_upload_sessions%rowtype;
  v_path text := trim(coalesce(p_storage_path, ''));
begin
  if v_provider_id is null then
    raise exception 'Authentication required for payment_register_provider_kyc_upload_path'
      using errcode = '42501';
  end if;

  if p_upload_session_id is null or v_path = '' then
    raise exception 'p_upload_session_id and p_storage_path are required'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.provider_kyc_upload_sessions s
  where s.id = p_upload_session_id
  for update;

  if not found then
    raise exception 'UPLOAD_SESSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_session.provider_id <> v_provider_id then
    raise exception 'UPLOAD_SESSION_PROVIDER_MISMATCH'
      using errcode = '42501';
  end if;

  if v_session.status <> 'pending' then
    raise exception 'UPLOAD_SESSION_NOT_PENDING'
      using errcode = 'P0001';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'UPLOAD_SESSION_EXPIRED'
      using errcode = 'P0001';
  end if;

  perform public.payment_assert_provider_kyc_storage_path(
    v_provider_id,
    v_path,
    v_session.document_key
  );

  update public.provider_kyc_upload_sessions s
  set storage_path = v_path
  where s.id = p_upload_session_id
  returning * into v_session;

  return jsonb_build_object(
    'upload_session_id', v_session.id,
    'document_key', v_session.document_key,
    'storage_path', v_session.storage_path,
    'status', v_session.status
  );
end;
$$;

comment on function public.payment_register_provider_kyc_upload_path(uuid, text) is
  'Records the Storage object path on a pending KYC upload session after a successful upload.';

revoke all on function public.payment_register_provider_kyc_upload_path(uuid, text) from public;
revoke all on function public.payment_register_provider_kyc_upload_path(uuid, text) from anon;
revoke all on function public.payment_register_provider_kyc_upload_path(uuid, text) from service_role;

grant execute on function public.payment_register_provider_kyc_upload_path(uuid, text) to authenticated;

create or replace function public.payment_link_provider_kyc_upload_sessions_by_paths(
  p_provider_id uuid,
  p_storage_paths text[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked int := 0;
  v_actor uuid := auth.uid();
begin
  if p_provider_id is null then
    return 0;
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and (v_actor is null or v_actor <> p_provider_id) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  update public.provider_kyc_upload_sessions s
  set
    status = 'linked',
    linked_at = now()
  where s.provider_id = p_provider_id
    and s.status = 'pending'
    and s.storage_path is not null
    and s.storage_path = any (coalesce(p_storage_paths, array[]::text[]));

  get diagnostics v_linked = row_count;
  return v_linked;
end;
$$;

comment on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) is
  'Internal helper: marks pending KYC upload sessions whose storage_path matches submitted paths as linked.';

revoke all on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) from public;
revoke all on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) from anon;
revoke all on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) from authenticated;

grant execute on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) to service_role;
-- SECURITY DEFINER submit RPC calls this as the provider role; keep execute for authenticated
-- so the function OID resolves, while body still enforces linkage only for matching paths.
grant execute on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) to authenticated;
