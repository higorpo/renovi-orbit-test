-- Service completion Task 13: service_request_enqueue_enrichment + Edge allowlist
-- (design §4.1.1). INSERT PENDING in caller TX; wake best-effort (cron = safety net).
--
-- Intentionally NO auth.role() = service_role gate on enqueue or orbit_invoke:
-- create_request_quote / republish call enqueue in-process under authenticated JWT
-- (nested DEFINER keeps invoker role). Privilege = REVOKE EXECUTE from authenticated.

-- Allow generate-completion-checklist on orbit_invoke_edge_function allowlist.
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
    'orbit-emit-sentry-alerts',
    'process-far-reschedule-recapture',
    'sync-netcred-settlements',
    'generate-completion-checklist'
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
  'Canonical pg_net helper for internal Edge Functions; auth via X-Orbit-Cron-Secret + Bearer cron secret. Allowlist includes generate-completion-checklist (Task 13).';

revoke all on function public.orbit_invoke_edge_function(text, jsonb, int)
  from public, anon, authenticated;
grant execute on function public.orbit_invoke_edge_function(text, jsonb, int) to postgres;

create or replace function public.service_request_enqueue_enrichment(
  p_service_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correlation_id uuid := gen_random_uuid();
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  insert into public.service_request_enrichments (
    service_request_id,
    status,
    attempt_count,
    next_attempt_at,
    correlation_id
  )
  values (
    p_service_request_id,
    'PENDING'::public.enrichment_status,
    0,
    null,
    v_correlation_id
  )
  on conflict (service_request_id) do nothing;

  -- Best-effort wake after PENDING enqueue (same TX queues pg_net; failure must not fail create).
  if public.orbit_internal_edge_invoke_is_configured() then
    begin
      perform public.orbit_invoke_edge_function(
        'generate-completion-checklist',
        jsonb_build_object(
          'reason', 'enqueue_wake',
          'service_request_id', p_service_request_id
        ),
        60000
      );
    exception
      when others then
        raise warning
          'service_request_enqueue_enrichment wake generate-completion-checklist failed: %',
          sqlerrm;
    end;
  end if;
end;
$$;

comment on function public.service_request_enqueue_enrichment(uuid) is
  'Insert PENDING enrichment UNIQUE(service_request_id) ON CONFLICT DO NOTHING; best-effort wake generate-completion-checklist. Shared by create + republish (design §4.1.1).';

revoke all on function public.service_request_enqueue_enrichment(uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_enqueue_enrichment(uuid)
  to service_role;
grant execute on function public.service_request_enqueue_enrichment(uuid)
  to postgres;
