-- Service completion Task 58: orphan upload janitor cron + Edge wake
-- (design §3.6 / §10.2). Claim RPC: Task 57; Storage delete in Edge.

-- Allowlist completion-evidence-orphan-janitor (+ keep prior slugs).
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
    'generate-completion-checklist',
    'completion-evidence-orphan-janitor'
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
  'Canonical pg_net helper for internal Edge Functions; allowlist includes generate-completion-checklist + completion-evidence-orphan-janitor (Task 58).';

revoke all on function public.orbit_invoke_edge_function(text, jsonb, int)
  from public, anon, authenticated;
grant execute on function public.orbit_invoke_edge_function(text, jsonb, int) to postgres;

-- After Edge Storage delete (missing object = success), drop registry rows.
create or replace function public.service_completion_janitor_orphan_uploads_finalize(
  p_object_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_janitor_orphan_uploads_finalize'
      using errcode = '42501';
  end if;

  if p_object_ids is null or coalesce(cardinality(p_object_ids), 0) = 0 then
    return jsonb_build_object('ok', true, 'deleted_count', 0);
  end if;

  delete from public.completion_evidence_upload_objects o
  where o.id = any (p_object_ids)
    and o.referenced_in_responses = false
    and o.janitor_claimed_at is not null;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted_count', v_deleted
  );
end;
$$;

comment on function public.service_completion_janitor_orphan_uploads_finalize(uuid[]) is
  'Delete claimed orphan upload_object registry rows after Edge Storage delete (Task 58). service_role only.';

revoke all on function public.service_completion_janitor_orphan_uploads_finalize(uuid[])
  from public, anon, authenticated;
grant execute on function public.service_completion_janitor_orphan_uploads_finalize(uuid[])
  to service_role;

create or replace function public.service_completion_cron_orphan_upload_janitor()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'service_completion_cron_orphan_upload_janitor';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_claim jsonb := '{}'::jsonb;
  v_sessions int := 0;
  v_objects int := 0;
  v_wake_requested boolean := false;
  v_wake_request_id bigint := null;
  v_error_count int := 0;
  v_error_samples jsonb := '[]'::jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    begin
      v_claim := public.service_completion_janitor_orphan_uploads(null);
      v_sessions := coalesce((v_claim->>'sessions_marked_expired')::int, 0);
      v_objects := coalesce((v_claim->>'objects_claimed')::int, 0);
    exception
      when others then
        v_error_count := v_error_count + 1;
        v_error_samples := v_error_samples || jsonb_build_array(
          jsonb_build_object(
            'step', 'claim',
            'sqlstate', sqlstate,
            'message', public.sanitize_job_error(sqlerrm)
          )
        );
        raise warning
          'service_completion_cron_orphan_upload_janitor claim failed sqlstate=% message=%',
          sqlstate,
          sqlerrm;
    end;

    if v_objects > 0 and public.orbit_internal_edge_invoke_is_configured() then
      begin
        v_wake_request_id := public.orbit_invoke_edge_function(
          'completion-evidence-orphan-janitor',
          jsonb_build_object(
            'reason', 'orphan_janitor',
            'claim', v_claim
          ),
          60000
        );
        v_wake_requested := true;
      exception
        when others then
          v_error_count := v_error_count + 1;
          v_error_samples := v_error_samples || jsonb_build_array(
            jsonb_build_object(
              'step', 'wake_edge',
              'sqlstate', sqlstate,
              'message', public.sanitize_job_error(sqlerrm)
            )
          );
          raise warning
            'service_completion_cron_orphan_upload_janitor wake failed sqlstate=% message=%',
            sqlstate,
            sqlerrm;
      end;
    end if;

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_sessions + v_objects,
      v_objects,
      v_error_count,
      jsonb_build_object(
        'sessions_marked_expired', v_sessions,
        'objects_claimed', v_objects,
        'wake_requested', v_wake_requested,
        'wake_request_id', v_wake_request_id,
        'error_samples', v_error_samples,
        'claim', coalesce(v_claim, '{}'::jsonb)
      ),
      case when v_error_count > 0 then 'row_errors' else null end
    );

    return jsonb_build_object(
      'job_run_id', v_job_run_id,
      'sessions_marked_expired', v_sessions,
      'objects_claimed', v_objects,
      'wake_requested', v_wake_requested,
      'wake_request_id', v_wake_request_id,
      'errors_count', v_error_count
    );
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.service_completion_cron_orphan_upload_janitor() is
  'pg_cron: claim orphan uploads + wake completion-evidence-orphan-janitor Edge for Storage delete; job_runs telemetry (Task 58).';

revoke all on function public.service_completion_cron_orphan_upload_janitor()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_orphan_upload_janitor()
  to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'service_completion_orphan_upload_janitor';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  -- Hourly; TTL is 24h so frequent enough without Storage spam.
  perform cron.schedule(
    'service_completion_orphan_upload_janitor',
    '20 * * * *',
    $$select public.service_completion_cron_orphan_upload_janitor();$$
  );
end;
$register$;
