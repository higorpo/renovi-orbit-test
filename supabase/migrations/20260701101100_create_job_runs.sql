-- CNS Wave A — task 12: cron batch telemetry (design §3.15, Req. 25).
-- One row per cron invocation; finished_at null signals stale/in-progress runs.

create table public.job_runs (
  id bigserial primary key,
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed_count int not null default 0 check (processed_count >= 0),
  transitioned_count int not null default 0 check (transitioned_count >= 0),
  error_count int not null default 0 check (error_count >= 0),
  duration_ms int check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.job_runs is
  'Append-mostly cron/batch telemetry for platform jobs (any feature may record runs by job_name).';

comment on column public.job_runs.finished_at is
  'Set when job completes; NULL beyond expected duration may alert ops (stale run).';

create index job_runs_name_started_idx
  on public.job_runs (job_name, started_at desc);
