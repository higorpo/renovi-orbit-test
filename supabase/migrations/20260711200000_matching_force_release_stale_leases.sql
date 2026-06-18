-- Matching M10d — stale dispatch lease janitor (design §6.3, task 46, Req 10A.8–10A.9).

create index if not exists service_request_dispatches_stale_lease_idx
  on public.service_request_dispatches (lease_expires_at)
  where lease_owner is not null;

comment on index public.service_request_dispatches_stale_lease_idx is
  'Ops janitor + stuck-lease alert: rows with expired lease_expires_at and active lease_owner.';

create or replace function public.matching_force_release_stale_leases(
  p_stale_after interval default interval '10 minutes',
  p_batch_limit int default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released int;
  v_cutoff timestamptz;
begin
  p_batch_limit := least(greatest(coalesce(p_batch_limit, 500), 1), 5000);
  v_cutoff := now() - coalesce(p_stale_after, interval '10 minutes');

  with candidates as (
    select d.id
    from public.service_request_dispatches d
    where d.lease_owner is not null
      and (
        (d.lease_expires_at is not null and d.lease_expires_at < v_cutoff)
        or (d.lease_expires_at is null)
      )
    order by d.lease_expires_at nulls first, d.updated_at
    limit p_batch_limit
    for update of d skip locked
  )
  update public.service_request_dispatches d
  set
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
  from candidates c
  where d.id = c.id;

  get diagnostics v_released = row_count;

  if v_released > 0 then
    raise log 'matching_stale_dispatch_lease_released_total count=% cutoff=%',
      v_released,
      v_cutoff;
  end if;

  return jsonb_build_object(
    'released_count', coalesce(v_released, 0),
    'cutoff_at', v_cutoff,
    'batch_limit', p_batch_limit
  );
end;
$$;

comment on function public.matching_force_release_stale_leases(interval, int) is
  'Ops janitor: clears stale dispatch leases (expired past p_stale_after or orphaned lease_owner). service_role only.';

revoke all on function public.matching_force_release_stale_leases(interval, int) from public;
revoke all on function public.matching_force_release_stale_leases(interval, int) from authenticated;
revoke all on function public.matching_force_release_stale_leases(interval, int) from anon;

grant execute on function public.matching_force_release_stale_leases(interval, int) to service_role;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'matching_force_release_stale_leases';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'matching_force_release_stale_leases',
  '*/5 * * * *',
  $$select public.matching_force_release_stale_leases(interval '10 minutes', 500);$$
);
