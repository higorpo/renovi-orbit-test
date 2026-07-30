-- Orbit internal pg_net auth: unified orbit_invoke_edge_function + wrapper delegation.
-- Bodies sourced from latest migrations (20260801680000, 20260801620000, 20260801485000,
-- 20260621100300) — local Supabase CLI was unavailable for pg_get_functiondef dump.

create or replace function public.orbit_internal_edge_invoke_is_configured()
returns boolean
language plpgsql
stable
security definer
set search_path = public, vault
as $$
declare
  v_url text;
  v_secret text;
begin
  select nullif(trim(decrypted_secret), '')
  into v_url
  from vault.decrypted_secrets
  where name = 'orbit_supabase_url';

  select nullif(trim(decrypted_secret), '')
  into v_secret
  from vault.decrypted_secrets
  where name = 'orbit_cron_secret';

  if v_url is null then
    v_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  end if;

  if v_secret is null then
    v_secret := nullif(btrim(current_setting('app.cron_secret', true)), '');
  end if;

  return v_url is not null and v_secret is not null;
end;
$$;

comment on function public.orbit_internal_edge_invoke_is_configured() is
  'True when orbit_invoke_edge_function has URL + cron secret (orbit_* vault or app.supabase_url/app.cron_secret GUCs).';

revoke all on function public.orbit_internal_edge_invoke_is_configured() from public;
revoke all on function public.orbit_internal_edge_invoke_is_configured() from anon;
revoke all on function public.orbit_internal_edge_invoke_is_configured() from authenticated;
grant execute on function public.orbit_internal_edge_invoke_is_configured() to postgres;

create or replace function public.orbit_invoke_edge_function(
  p_function_slug text,
  p_body jsonb default '{}'::jsonb,
  p_timeout_milliseconds int default 55000
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_slug text;
  v_url text;
  v_secret text;
  v_allowed constant text[] := array[
    'message-dispatcher-worker',
    'schedule-netcred-charges',
    'detect-netcred-onboarding',
    'reconcile-netcred-payments',
    'reconcile-inanalysis-auto-cancel-voids',
    'payment-emit-sentry-alerts',
    'process-far-reschedule-recapture'
  ];
begin
  v_slug := nullif(btrim(p_function_slug), '');

  if v_slug is null then
    raise exception 'p_function_slug is required'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' or not (v_slug = any (v_allowed)) then
    raise exception 'INVALID_EDGE_FUNCTION_SLUG'
      using errcode = '22023';
  end if;

  select nullif(trim(decrypted_secret), '')
  into v_url
  from vault.decrypted_secrets
  where name = 'orbit_supabase_url';

  select nullif(trim(decrypted_secret), '')
  into v_secret
  from vault.decrypted_secrets
  where name = 'orbit_cron_secret';

  if v_url is null then
    v_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  end if;

  if v_secret is null then
    v_secret := nullif(btrim(current_setting('app.cron_secret', true)), '');
  end if;

  if v_url is null or v_secret is null then
    raise exception
      'Orbit internal EF invoke requires orbit_supabase_url and orbit_cron_secret (vault or GUC app.supabase_url/app.cron_secret)'
      using errcode = '22023';
  end if;

  return net.http_post(
    url := v_url || '/functions/v1/' || v_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'X-Orbit-Cron-Secret', v_secret
    ),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := greatest(coalesce(p_timeout_milliseconds, 55000), 1000)
  );
end;
$$;

comment on function public.orbit_invoke_edge_function(text, jsonb, int) is
  'Canonical pg_net helper for internal Edge Functions; auth via X-Orbit-Cron-Secret + Bearer cron secret.';

revoke all on function public.orbit_invoke_edge_function(text, jsonb, int) from public;
revoke all on function public.orbit_invoke_edge_function(text, jsonb, int) from anon;
revoke all on function public.orbit_invoke_edge_function(text, jsonb, int) from authenticated;
grant execute on function public.orbit_invoke_edge_function(text, jsonb, int) to postgres;

create or replace function public.payment_cron_invoke_edge_function(
  p_function_name text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timeout_ms int := 55000;
begin
  -- schedule-netcred-charges: raise above legacy 55s so batch_size 3 × gateway RTT fits.
  if nullif(btrim(p_function_name), '') = 'schedule-netcred-charges' then
    v_timeout_ms := 90000;
  end if;

  return public.orbit_invoke_edge_function(
    p_function_name,
    '{}'::jsonb,
    v_timeout_ms
  );
end;
$$;

comment on function public.payment_cron_invoke_edge_function(text) is
  'Payment cron wrapper: delegates to orbit_invoke_edge_function (allowlist enforced there). Uses 90s timeout for schedule-netcred-charges.';

create or replace function public.payment_cron_post_sentry_alerts(
  p_alerts jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_alerts is null or jsonb_typeof(p_alerts) <> 'array' or jsonb_array_length(p_alerts) = 0 then
    return null;
  end if;

  begin
    return public.orbit_invoke_edge_function(
      'payment-emit-sentry-alerts',
      jsonb_build_object('alerts', p_alerts),
      15000
    );
  exception
    when others then
      raise warning 'payment_cron_post_sentry_alerts skipped: %', sqlerrm;
      return null;
  end;
end;
$$;

comment on function public.payment_cron_post_sentry_alerts(jsonb) is
  'Payment Sentry bridge: delegates to orbit_invoke_edge_function(payment-emit-sentry-alerts).';

create or replace function message_dispatcher.message_dispatcher_invoke_worker()
returns integer
language plpgsql
security definer
set search_path = message_dispatcher, public, auth, extensions
as $$
declare
  v_queued_count bigint;
  v_batch_size integer;
  v_max_workers integer;
  v_worker_count integer;
  v_i integer;
begin
  if not public.orbit_internal_edge_invoke_is_configured() then
    return 0;
  end if;

  select count(*)
  into v_queued_count
  from message_dispatcher.message_dispatches d
  where d.status = 'QUEUED'
    and d.scheduled_for <= now();

  if v_queued_count = 0 then
    return 0;
  end if;

  select coalesce((pc.value #>> '{}')::integer, 50)
  into v_batch_size
  from public.platform_constants pc
  where pc.key = 'message_dispatcher.checkout_batch_size';
  v_batch_size := greatest(coalesce(v_batch_size, 50), 1);

  select least(
    coalesce(
      (
        select (pc.value #>> '{}')::integer
        from public.platform_constants pc
        where pc.key = 'message_dispatcher.max_parallel_workers'
      ),
      5
    ),
    5
  )
  into v_max_workers;
  v_max_workers := greatest(coalesce(v_max_workers, 5), 1);

  v_worker_count := least(
    ceil(v_queued_count::numeric / v_batch_size::numeric)::integer,
    v_max_workers
  );

  for v_i in 1 .. v_worker_count loop
    perform public.orbit_invoke_edge_function(
      'message-dispatcher-worker',
      '{}'::jsonb,
      25000
    );
  end loop;

  return v_worker_count;
end;
$$;

comment on function message_dispatcher.message_dispatcher_invoke_worker() is
  'MMD fan-out: delegates each worker tick to orbit_invoke_edge_function(message-dispatcher-worker).';
