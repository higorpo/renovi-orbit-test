-- Payment Task 62: acquire_or_refresh_netcred_token RPC (design §6.3, Req 2).
-- Serializes JWT refresh via FOR UPDATE + advisory lock; EF performs tokenAuth GraphQL call.

create or replace function public.acquire_or_refresh_netcred_token(
  p_new_token text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_gateway_tokens%rowtype;
  v_refresh_threshold interval := interval '60 minutes';
  v_lock_key bigint := 880001;
  v_wait_attempt int;
begin
  perform set_config('lock_timeout', '500ms', true);

  if p_new_token is not null then
    insert into public.payment_gateway_tokens (
      gateway_slug,
      token,
      expires_at,
      refreshed_at
    )
    values (
      'netcred',
      p_new_token,
      coalesce(p_expires_at, now() + interval '24 hours'),
      now()
    )
    on conflict (gateway_slug) do update
    set
      token = excluded.token,
      expires_at = excluded.expires_at,
      refreshed_at = now(),
      updated_at = now()
    returning * into v_row;

    perform pg_advisory_unlock(v_lock_key);

    return jsonb_build_object(
      'status', 'refreshed',
      'token', v_row.token,
      'expires_at', v_row.expires_at
    );
  end if;

  select *
  into v_row
  from public.payment_gateway_tokens pgt
  where pgt.gateway_slug = 'netcred'
  for update;

  if found and v_row.expires_at > now() + v_refresh_threshold then
    return jsonb_build_object(
      'status', 'cached',
      'token', v_row.token,
      'expires_at', v_row.expires_at
    );
  end if;

  if not pg_try_advisory_lock(v_lock_key) then
    for v_wait_attempt in 1..30 loop
      select *
      into v_row
      from public.payment_gateway_tokens pgt
      where pgt.gateway_slug = 'netcred';

      if found and v_row.expires_at > now() + v_refresh_threshold then
        return jsonb_build_object(
          'status', 'cached',
          'token', v_row.token,
          'expires_at', v_row.expires_at
        );
      end if;

      perform pg_sleep(0.2);
    end loop;

    raise exception 'NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT'
      using errcode = 'P0001';
  end if;

  select *
  into v_row
  from public.payment_gateway_tokens pgt
  where pgt.gateway_slug = 'netcred'
  for update;

  if found and v_row.expires_at > now() + v_refresh_threshold then
    perform pg_advisory_unlock(v_lock_key);
    return jsonb_build_object(
      'status', 'cached',
      'token', v_row.token,
      'expires_at', v_row.expires_at
    );
  end if;

  return jsonb_build_object('status', 'needs_refresh');
end;
$$;

comment on function public.acquire_or_refresh_netcred_token(text, timestamptz) is
  'Lock + read NetCred JWT cache; upsert after EF tokenAuth; advisory lock serializes refresh.';

create or replace function public.release_netcred_token_refresh_lock()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_unlock(880001);
end;
$$;

comment on function public.release_netcred_token_refresh_lock() is
  'Best-effort release of NetCred JWT refresh advisory lock after tokenAuth failure.';

revoke all on function public.acquire_or_refresh_netcred_token(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.release_netcred_token_refresh_lock()
  from public, anon, authenticated;

grant execute on function public.acquire_or_refresh_netcred_token(text, timestamptz)
  to service_role, postgres;
grant execute on function public.release_netcred_token_refresh_lock()
  to service_role, postgres;
