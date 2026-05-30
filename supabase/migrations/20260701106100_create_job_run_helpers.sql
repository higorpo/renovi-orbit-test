-- Platform — task 64: shared job_runs helpers (design §3.15; Req. 21, 25).
-- Generic cron/batch telemetry; not CNS-specific.

create or replace function public.sanitize_job_error(p_message text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(
    regexp_replace(
      coalesce(nullif(btrim(p_message), ''), 'unknown error'),
      E'[\\n\\r\\t]+',
      ' ',
      'g'
    ),
    500
  );
$$;

comment on function public.sanitize_job_error(text) is
  'Truncate and flatten cron failure messages before persisting to job_runs metadata.';

create or replace function public.job_run_begin(
  p_job_name text,
  p_job_version text default 'v1'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_run_id bigint;
begin
  if nullif(btrim(p_job_name), '') is null then
    raise exception 'p_job_name is required'
      using errcode = '22023';
  end if;

  insert into public.job_runs (job_name, started_at, metadata)
  values (
    p_job_name,
    clock_timestamp(),
    jsonb_build_object('job_version', coalesce(nullif(btrim(p_job_version), ''), 'v1'))
  )
  returning id into v_job_run_id;

  return v_job_run_id;
end;
$$;

comment on function public.job_run_begin(text, text) is
  'Open a job_runs row for a cron/batch invocation (R25-AC05).';

create or replace function public.job_run_finish(
  p_job_run_id bigint,
  p_started_at timestamptz,
  p_processed_count int default 0,
  p_transitioned_count int default 0,
  p_error_count int default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_fatal_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration_ms int;
  v_metadata jsonb;
  v_error_count int := greatest(coalesce(p_error_count, 0), 0);
begin
  if p_job_run_id is null then
    return;
  end if;

  if p_fatal_error is not null then
    v_error_count := greatest(v_error_count, 1);
  end if;

  v_duration_ms := (
    extract(epoch from (clock_timestamp() - p_started_at)) * 1000
  )::int;

  select coalesce(jr.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  into v_metadata
  from public.job_runs jr
  where jr.id = p_job_run_id;

  if p_fatal_error is not null then
    v_metadata := v_metadata || jsonb_build_object(
      'fatal_error', public.sanitize_job_error(p_fatal_error)
    );
  end if;

  update public.job_runs
  set
    finished_at = now(),
    processed_count = greatest(coalesce(p_processed_count, 0), 0),
    transitioned_count = greatest(coalesce(p_transitioned_count, 0), 0),
    error_count = v_error_count,
    duration_ms = v_duration_ms,
    metadata = v_metadata
  where id = p_job_run_id;
end;
$$;

comment on function public.job_run_finish(
  bigint,
  timestamptz,
  int,
  int,
  int,
  jsonb,
  text
) is
  'Close a job_runs row with counts, duration, merged metadata, and optional sanitized fatal error.';

create or replace function public.job_run_abort_latest(
  p_job_name text,
  p_fatal_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_run_id bigint;
  v_started_at timestamptz;
begin
  select jr.id, jr.started_at
  into v_job_run_id, v_started_at
  from public.job_runs jr
  where jr.job_name = p_job_name
    and jr.finished_at is null
  order by jr.started_at desc
  limit 1;

  perform public.job_run_finish(
    v_job_run_id,
    v_started_at,
    0,
    0,
    1,
    '{}'::jsonb,
    p_fatal_error
  );
end;
$$;

comment on function public.job_run_abort_latest(text, text) is
  'Best-effort close for the latest in-flight job_runs row after an uncaught cron failure.';

revoke all on function public.sanitize_job_error(text) from public;
revoke all on function public.job_run_begin(text, text) from public;
revoke all on function public.job_run_finish(bigint, timestamptz, int, int, int, jsonb, text) from public;
revoke all on function public.job_run_abort_latest(text, text) from public;

grant execute on function public.sanitize_job_error(text) to service_role;
grant execute on function public.job_run_begin(text, text) to service_role;
grant execute on function public.job_run_finish(bigint, timestamptz, int, int, int, jsonb, text) to service_role;
grant execute on function public.job_run_abort_latest(text, text) to service_role;

grant execute on function public.job_run_begin(text, text) to postgres;
grant execute on function public.job_run_finish(bigint, timestamptz, int, int, int, jsonb, text) to postgres;
grant execute on function public.job_run_abort_latest(text, text) to postgres;
