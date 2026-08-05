-- Service completion Task 32: service_completion_create_upload_session (design §4.10 / §3.6).
-- Provider-only; CONFIRMED CS; criterion_block_id must exist on READY checklist schema.

create or replace function public.service_completion_create_upload_session(
  p_contracted_service_id uuid,
  p_criterion_block_id text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_session public.completion_evidence_upload_sessions%rowtype;
  v_session_id uuid;
  v_block_id text := nullif(btrim(p_criterion_block_id), '');
  v_idem text := nullif(btrim(p_idempotency_key), '');
  v_max_files int;
  v_ttl_hours int;
  v_prefix text;
  v_block jsonb;
  v_config jsonb;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for service_completion_create_upload_session'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if v_block_id is null then
    raise exception 'p_criterion_block_id is required'
      using errcode = '22023';
  end if;

  -- Idempotent replay by UNIQUE idempotency_key
  if v_idem is not null then
    select s.*
    into v_session
    from public.completion_evidence_upload_sessions s
    where s.idempotency_key = v_idem;

    if found then
      if v_session.provider_id is distinct from v_provider_id
        or v_session.contracted_service_id is distinct from p_contracted_service_id
      then
        raise exception 'UPLOAD_SESSION_IDEMPOTENCY_CONFLICT'
          using errcode = 'P0001';
      end if;

      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'upload_session_id', v_session.id,
        'contracted_service_id', v_session.contracted_service_id,
        'criterion_block_id', v_session.criterion_block_id,
        'status', v_session.status,
        'storage_bucket', v_session.storage_bucket,
        'storage_prefix', v_session.storage_prefix,
        'max_files', v_session.max_files,
        'expires_at', v_session.expires_at
      );
    end if;
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.provider_id = v_provider_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  if v_cs.status is distinct from 'CONFIRMED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  select e.*
  into v_enrichment
  from public.service_request_enrichments e
  where e.service_request_id = v_cs.service_request_id
    and e.status = 'READY'::public.enrichment_status
    and e.checklist_schema is not null
  limit 1;

  if not found then
    raise exception 'CHECKLIST_REQUIRED'
      using errcode = 'P0001';
  end if;

  select b.value
  into v_block
  from jsonb_array_elements(coalesce(v_enrichment.checklist_schema -> 'blocks', '[]'::jsonb)) as b(value)
  where b.value ->> 'type' = 'completion_criterion'
    and nullif(btrim(b.value ->> 'id'), '') = v_block_id
  limit 1;

  if v_block is null then
    raise exception 'CRITERION_BLOCK_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  v_max_files := public.platform_constant_int('checklist_evidence_max', 5);
  v_config := v_block -> 'config';
  if v_config is not null and v_config ? 'evidence_max' then
    begin
      v_max_files := greatest(1, least(v_max_files, (v_config ->> 'evidence_max')::int));
    exception
      when others then
        null;
    end;
  end if;

  v_ttl_hours := public.platform_constant_int('completion_evidence_orphan_ttl_hours', 24);
  v_session_id := gen_random_uuid();
  v_prefix := format('%s/%s/', p_contracted_service_id::text, v_session_id::text);

  insert into public.completion_evidence_upload_sessions (
    id,
    contracted_service_id,
    provider_id,
    criterion_block_id,
    status,
    storage_bucket,
    storage_prefix,
    max_files,
    expires_at,
    idempotency_key
  )
  values (
    v_session_id,
    p_contracted_service_id,
    v_provider_id,
    v_block_id,
    'open'::public.completion_upload_session_status,
    'completion-evidence',
    v_prefix,
    v_max_files,
    now() + make_interval(hours => v_ttl_hours),
    v_idem
  )
  returning * into v_session;

  raise log
    'service_completion_create_upload_session session_id=% cs_id=% criterion=%',
    v_session.id,
    p_contracted_service_id,
    v_block_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'upload_session_id', v_session.id,
    'contracted_service_id', v_session.contracted_service_id,
    'criterion_block_id', v_session.criterion_block_id,
    'status', v_session.status,
    'storage_bucket', v_session.storage_bucket,
    'storage_prefix', v_session.storage_prefix,
    'max_files', v_session.max_files,
    'expires_at', v_session.expires_at,
    'path_layout', '{contracted_service_id}/{session_id}/{uuid_filename}'
  );
end;
$$;

comment on function public.service_completion_create_upload_session(uuid, text, text) is
  'Provider creates open completion-evidence upload session for a READY checklist criterion block; idempotent by key (Task 32 / design §4.10).';

revoke all on function public.service_completion_create_upload_session(uuid, text, text)
  from public;
revoke all on function public.service_completion_create_upload_session(uuid, text, text)
  from anon;
revoke all on function public.service_completion_create_upload_session(uuid, text, text)
  from service_role;

grant execute on function public.service_completion_create_upload_session(uuid, text, text)
  to authenticated;
grant execute on function public.service_completion_create_upload_session(uuid, text, text)
  to postgres;
