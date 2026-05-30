-- CNS Phase 5 — task 49: orphan chat-media janitor (design §5.2, Req. 26, R26-AC02, R3-AC06).
-- Migration order: runs AFTER task 15 (chat_media_upload_sessions + chat-media bucket).

create or replace function public.cns_janitor_orphan_media(
  p_batch_size int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_session record;
  v_processed int := 0;
  v_expired_count int := 0;
  v_bytes_deleted bigint := 0;
  v_objects_deleted int := 0;
  v_delete_failures int := 0;
  v_path_prefix text;
  v_session_bytes bigint;
  v_session_objects int;
  v_duration_ms int;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  for v_session in
    select s.*
    from public.chat_media_upload_sessions s
    where s.status = 'pending'
      and s.expires_at < now() - interval '24 hours'
    order by s.expires_at
    for update of s skip locked
    limit p_batch_size
  loop
    v_processed := v_processed + 1;
    v_path_prefix := v_session.chat_id::text || '/' || v_session.id::text || '/';

    begin
      with deleted as (
        delete from storage.objects o
        where o.bucket_id = 'chat-media'
          and o.name like v_path_prefix || '%'
        returning coalesce((o.metadata ->> 'size')::bigint, 0) as object_size
      )
      select
        coalesce(sum(object_size), 0),
        count(*)
      into v_session_bytes, v_session_objects
      from deleted;

      update public.chat_media_upload_sessions
      set status = 'expired'
      where id = v_session.id
        and status = 'pending';

      v_bytes_deleted := v_bytes_deleted + v_session_bytes;
      v_objects_deleted := v_objects_deleted + v_session_objects;
      v_expired_count := v_expired_count + 1;
    exception
      when others then
        v_delete_failures := v_delete_failures + 1;
        raise log 'cns_janitor_orphan_media delete_failed session_id=% chat_id=% sqlstate=% message=%',
          v_session.id,
          v_session.chat_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_expired_count > 0 or v_delete_failures > 0 then
    raise log 'cns_orphan_media_bytes_deleted=% sessions_expired=% objects_deleted=% delete_failures=%',
      v_bytes_deleted,
      v_expired_count,
      v_objects_deleted,
      v_delete_failures;
  end if;

  return jsonb_build_object(
    'processed_count', v_processed,
    'expired_count', v_expired_count,
    'bytes_deleted', v_bytes_deleted,
    'objects_deleted', v_objects_deleted,
    'delete_failures', v_delete_failures,
    'duration_ms', v_duration_ms
  );
end;
$$;

comment on function public.cns_janitor_orphan_media(int) is
  'Daily janitor: delete chat-media Storage objects for pending upload sessions past retention (expires_at < now()-24h) and mark expired (R26-AC02).';

revoke all on function public.cns_janitor_orphan_media(int) from public;
revoke all on function public.cns_janitor_orphan_media(int) from authenticated;
revoke all on function public.cns_janitor_orphan_media(int) from anon;

grant execute on function public.cns_janitor_orphan_media(int) to service_role;
