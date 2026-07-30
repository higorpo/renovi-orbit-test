-- Payment: janitor for orphaned provider KYC Storage objects (Option A upload sessions).

create or replace function public.payment_janitor_orphan_kyc_documents(
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
    from public.provider_kyc_upload_sessions s
    where s.status = 'pending'
      and s.expires_at < now() - interval '24 hours'
    order by s.expires_at
    for update of s skip locked
    limit p_batch_size
  loop
    v_processed := v_processed + 1;

    begin
      if nullif(btrim(v_session.storage_path), '') is not null then
        with deleted as (
          delete from storage.objects o
          where o.bucket_id = 'provider-kyc-documents'
            and o.name = v_session.storage_path
          returning coalesce((o.metadata ->> 'size')::bigint, 0) as object_size
        )
        select
          coalesce(sum(object_size), 0),
          count(*)
        into v_session_bytes, v_session_objects
        from deleted;
      else
        v_session_bytes := 0;
        v_session_objects := 0;
      end if;

      update public.provider_kyc_upload_sessions
      set status = 'expired'
      where id = v_session.id
        and status = 'pending';

      v_bytes_deleted := v_bytes_deleted + v_session_bytes;
      v_objects_deleted := v_objects_deleted + v_session_objects;
      v_expired_count := v_expired_count + 1;
    exception
      when others then
        v_delete_failures := v_delete_failures + 1;
        raise log 'payment_janitor_orphan_kyc_documents delete_failed session_id=% provider_id=% sqlstate=% message=%',
          v_session.id,
          v_session.provider_id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - v_started_at)) * 1000
  )::int;

  if v_expired_count > 0 or v_delete_failures > 0 then
    raise log 'payment_orphan_kyc_bytes_deleted=% sessions_expired=% objects_deleted=% delete_failures=%',
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

comment on function public.payment_janitor_orphan_kyc_documents(int) is
  'Expires pending KYC upload sessions past retention and deletes unlinked Storage objects (service_role/cron).';

revoke all on function public.payment_janitor_orphan_kyc_documents(int) from public;
revoke all on function public.payment_janitor_orphan_kyc_documents(int) from anon;
revoke all on function public.payment_janitor_orphan_kyc_documents(int) from authenticated;

grant execute on function public.payment_janitor_orphan_kyc_documents(int) to service_role;
grant execute on function public.payment_janitor_orphan_kyc_documents(int) to postgres;

alter function public.payment_janitor_orphan_kyc_documents(int)
  set statement_timeout = '120s';
