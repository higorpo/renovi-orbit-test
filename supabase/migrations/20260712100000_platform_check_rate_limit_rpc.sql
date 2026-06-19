-- Atomic platform rate limit check for Edge Functions (replaces SELECT-then-UPDATE in rateLimiter.ts).

create or replace function public.platform_check_rate_limit(
  p_key text,
  p_per_minute integer,
  p_window_ms bigint default 60000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_row public.platform_rate_limits%rowtype;
  v_new_count integer;
  v_retry_after_sec integer;
begin
  if nullif(btrim(p_key), '') is null then
    raise exception 'p_key is required'
      using errcode = '22023';
  end if;

  if coalesce(p_per_minute, 0) < 1 then
    raise exception 'p_per_minute must be positive'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.platform_rate_limits
  where key = p_key
  for update;

  if not found then
    begin
      insert into public.platform_rate_limits (
        key,
        count,
        reset_at,
        burst_count,
        blocked_until,
        updated_at
      )
      values (
        p_key,
        1,
        v_now_ms + p_window_ms,
        1,
        null,
        now()
      )
      returning * into v_row;

      return jsonb_build_object(
        'allowed', true,
        'remaining', greatest(p_per_minute - 1, 0),
        'retry_after', 0
      );
    exception
      when unique_violation then
        select *
        into v_row
        from public.platform_rate_limits
        where key = p_key
        for update;
    end;
  end if;

  if v_now_ms > v_row.reset_at then
    update public.platform_rate_limits
    set
      count = 1,
      reset_at = v_now_ms + p_window_ms,
      burst_count = 1,
      blocked_until = null,
      updated_at = now()
    where key = p_key
    returning * into v_row;

    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(p_per_minute - 1, 0),
      'retry_after', 0
    );
  end if;

  v_new_count := coalesce(v_row.count, 0) + 1;

  if v_new_count > p_per_minute then
    v_retry_after_sec := greatest(
      1,
      ceil(greatest(v_row.reset_at - v_now_ms, 0)::numeric / 1000.0)::integer
    );

    update public.platform_rate_limits
    set
      count = v_new_count,
      burst_count = coalesce(burst_count, 0) + 1,
      updated_at = now()
    where key = p_key;

    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after', v_retry_after_sec
    );
  end if;

  update public.platform_rate_limits
  set
    count = v_new_count,
    burst_count = coalesce(burst_count, 0) + 1,
    updated_at = now()
  where key = p_key;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_per_minute - v_new_count, 0),
    'retry_after', 0
  );
end;
$$;

comment on function public.platform_check_rate_limit(text, integer, bigint) is
  'Atomically increments platform_rate_limits and returns allowed/remaining/retry_after for Edge Functions.';

revoke all on function public.platform_check_rate_limit(text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.platform_check_rate_limit(text, integer, bigint)
  to service_role;
