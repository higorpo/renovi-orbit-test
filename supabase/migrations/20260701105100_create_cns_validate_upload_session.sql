-- CNS Phase 7 — task 53: upload session validation for chat-upload-media Edge (design §5.2, Req. 3, R3-AC06).
-- Migration order: runs AFTER task 15 (chat_media_upload_sessions).

create or replace function public.cns_validate_upload_session(
  p_upload_session_id uuid,
  p_chat_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.chat_media_upload_sessions%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required for cns_validate_upload_session'
      using errcode = '42501';
  end if;

  if p_upload_session_id is null then
    raise exception 'p_upload_session_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.chat_media_upload_sessions s
  where s.id = p_upload_session_id;

  if not found then
    raise exception 'UPLOAD_SESSION_NOT_FOUND'
      using errcode = '42501';
  end if;

  if p_chat_id is not null and v_session.chat_id <> p_chat_id then
    raise exception 'UPLOAD_SESSION_CHAT_MISMATCH'
      using errcode = '42501';
  end if;

  if v_session.uploader_id <> v_actor then
    raise exception 'UPLOAD_SESSION_UPLOADER_MISMATCH'
      using errcode = '42501';
  end if;

  if not public.is_chat_participant(v_session.chat_id) then
    raise exception 'NOT_A_PARTICIPANT'
      using errcode = '42501';
  end if;

  if v_session.status <> 'pending' then
    raise exception 'UPLOAD_SESSION_NOT_PENDING'
      using errcode = '42501';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'UPLOAD_SESSION_EXPIRED'
      using errcode = '42501';
  end if;

  raise log 'cns_upload_validation_total session_id=% chat_id=% uploader_id=%',
    v_session.id,
    v_session.chat_id,
    v_session.uploader_id;

  return jsonb_build_object(
    'upload_session_id', v_session.id,
    'chat_id', v_session.chat_id,
    'uploader_id', v_session.uploader_id,
    'status', v_session.status,
    'expires_at', v_session.expires_at,
    'storage_path_prefix', v_session.chat_id::text || '/' || v_session.id::text || '/'
  );
end;
$$;

comment on function public.cns_validate_upload_session(uuid, uuid) is
  'Edge pre-upload gate: caller must be uploader + chat participant; session pending and not expired (R3-AC06).';

revoke all on function public.cns_validate_upload_session(uuid, uuid) from public;
revoke all on function public.cns_validate_upload_session(uuid, uuid) from anon;

grant execute on function public.cns_validate_upload_session(uuid, uuid) to authenticated;
grant execute on function public.cns_validate_upload_session(uuid, uuid) to service_role;
