-- Service completion Task 33: service_completion_register_upload_object (design §4.10 / §3.6).
-- Provider registers a Storage path under an open session; idempotent by UNIQUE storage_path.

create or replace function public.service_completion_register_upload_object(
  p_upload_session_id uuid,
  p_storage_path text,
  p_content_checksum text default null,
  p_byte_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := auth.uid();
  v_session public.completion_evidence_upload_sessions%rowtype;
  v_object public.completion_evidence_upload_objects%rowtype;
  v_path text := trim(coalesce(p_storage_path, ''));
  v_checksum text := nullif(btrim(p_content_checksum), '');
  v_count int;
begin
  if v_provider_id is null then
    raise exception 'Authentication required for service_completion_register_upload_object'
      using errcode = '42501';
  end if;

  if p_upload_session_id is null or v_path = '' then
    raise exception 'p_upload_session_id and p_storage_path are required'
      using errcode = '22023';
  end if;

  if p_byte_size is not null and p_byte_size <= 0 then
    raise exception 'p_byte_size must be null or > 0'
      using errcode = '22023';
  end if;

  if v_path ~ '^https?://' or position(chr(10) in v_path) > 0 then
    raise exception 'INVALID_STORAGE_PATH'
      using errcode = '22023';
  end if;

  select s.*
  into v_session
  from public.completion_evidence_upload_sessions s
  where s.id = p_upload_session_id
  for update;

  if not found then
    raise exception 'UPLOAD_SESSION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_session.provider_id is distinct from v_provider_id then
    raise exception 'UPLOAD_SESSION_PROVIDER_MISMATCH'
      using errcode = '42501';
  end if;

  if v_session.status is distinct from 'open'::public.completion_upload_session_status then
    raise exception 'UPLOAD_SESSION_NOT_OPEN'
      using errcode = 'P0001';
  end if;

  if v_session.expires_at <= now() then
    update public.completion_evidence_upload_sessions
    set status = 'expired'::public.completion_upload_session_status,
        updated_at = now()
    where id = v_session.id
      and status = 'open'::public.completion_upload_session_status;

    raise exception 'UPLOAD_SESSION_EXPIRED'
      using errcode = 'P0001';
  end if;

  -- Path must live under the session prefix (cs_id/session_id/…)
  if not (v_path like v_session.storage_prefix || '%') then
    raise exception 'STORAGE_PATH_PREFIX_MISMATCH'
      using errcode = '22023';
  end if;

  -- Idempotent replay: same path already registered
  select o.*
  into v_object
  from public.completion_evidence_upload_objects o
  where o.storage_path = v_path;

  if found then
    if v_object.session_id is distinct from p_upload_session_id then
      raise exception 'STORAGE_PATH_ALREADY_REGISTERED'
        using errcode = 'P0001';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'upload_object_id', v_object.id,
      'upload_session_id', v_object.session_id,
      'storage_path', v_object.storage_path,
      'content_checksum', v_object.content_checksum,
      'byte_size', v_object.byte_size,
      'referenced_in_responses', v_object.referenced_in_responses
    );
  end if;

  select count(*)::int
  into v_count
  from public.completion_evidence_upload_objects o
  where o.session_id = p_upload_session_id;

  if v_count >= v_session.max_files then
    raise exception 'UPLOAD_SESSION_MAX_FILES'
      using errcode = 'P0001';
  end if;

  insert into public.completion_evidence_upload_objects (
    session_id,
    storage_path,
    content_checksum,
    byte_size
  )
  values (
    p_upload_session_id,
    v_path,
    v_checksum,
    p_byte_size
  )
  returning * into v_object;

  raise log
    'service_completion_register_upload_object session_id=% path=% object_id=%',
    p_upload_session_id,
    v_path,
    v_object.id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'upload_object_id', v_object.id,
    'upload_session_id', v_object.session_id,
    'storage_path', v_object.storage_path,
    'content_checksum', v_object.content_checksum,
    'byte_size', v_object.byte_size,
    'referenced_in_responses', v_object.referenced_in_responses
  );
end;
$$;

comment on function public.service_completion_register_upload_object(uuid, text, text, int) is
  'Provider registers a completion-evidence Storage path under an open session; UNIQUE path is idempotent (Task 33 / design §4.10). Does not proxy file bytes.';

revoke all on function public.service_completion_register_upload_object(uuid, text, text, int)
  from public;
revoke all on function public.service_completion_register_upload_object(uuid, text, text, int)
  from anon;
revoke all on function public.service_completion_register_upload_object(uuid, text, text, int)
  from service_role;

grant execute on function public.service_completion_register_upload_object(uuid, text, text, int)
  to authenticated;
grant execute on function public.service_completion_register_upload_object(uuid, text, text, int)
  to postgres;
