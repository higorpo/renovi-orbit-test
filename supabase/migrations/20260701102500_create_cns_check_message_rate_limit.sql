-- CNS Wave B — task 26: per-participant message rate limit (design §3.14, §4.2, Req. 3).
-- Migration order: runs AFTER task 11 (chat_rate_limit_buckets) and task 25.

create or replace function public.cns_check_message_rate_limit(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := date_trunc('minute', clock_timestamp());
  v_limit int := public.platform_constant_int('chats.message_rate_limit_per_minute', 30);
  v_count int;
  v_retry_after int;
begin
  if v_user_id is null then
    raise exception 'Authentication required for cns_check_message_rate_limit'
      using errcode = '42501';
  end if;

  if not public.is_chat_participant(p_chat_id) then
    raise exception 'Not a chat participant'
      using errcode = '42501';
  end if;

  insert into public.chat_rate_limit_buckets (chat_id, user_id, window_started_at, message_count)
  values (p_chat_id, v_user_id, v_window_start, 1)
  on conflict (chat_id, user_id, window_started_at)
  do update
    set message_count = public.chat_rate_limit_buckets.message_count + 1
  returning message_count into v_count;

  if v_count > v_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_window_start + interval '1 minute' - clock_timestamp())))::int
    );

    raise log 'cns_rate_limit_exceeded chat_id=% user_id=% count=% limit=% retry_after_seconds=%',
      p_chat_id,
      v_user_id,
      v_count,
      v_limit,
      v_retry_after;

    raise exception 'RATE_LIMITED'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('retry_after_seconds', v_retry_after)::text;
  end if;
end;
$$;

comment on function public.cns_check_message_rate_limit(uuid) is
  'Increments 1-minute sliding window bucket; raises RATE_LIMITED (P0001) with retry_after_seconds when over chats.message_rate_limit_per_minute (R3-AC11).';

revoke all on function public.cns_check_message_rate_limit(uuid) from public;
revoke all on function public.cns_check_message_rate_limit(uuid) from authenticated;
revoke all on function public.cns_check_message_rate_limit(uuid) from anon;

grant execute on function public.cns_check_message_rate_limit(uuid) to service_role;
