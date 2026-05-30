-- Domain events outbox — task 47: stale lease janitor (design §6.4, Req. 27, R27-AC02, OAC-07).
-- Migration order: runs AFTER task 7 (domain_events table + stale_lease index).

create or replace function public.domain_events_release_stale_leases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer;
begin
  with candidates as (
    select de.id
    from public.domain_events de
    where de.processed_at is null
      and de.dead_letter = false
      and (
        (de.locked_until is not null and de.locked_until < now())
        or (de.locked_until is null and de.locked_by is not null)
      )
    order by de.locked_until nulls first, de.created_at
    limit 500
    for update of de skip locked
  )
  update public.domain_events e
  set
    locked_until = null,
    locked_by = null
  from candidates c
  where e.id = c.id;

  get diagnostics v_released = row_count;

  if v_released > 0 then
    raise log 'domain_events_stale_lease_released_total count=%', v_released;
  end if;

  return coalesce(v_released, 0);
end;
$$;

comment on function public.domain_events_release_stale_leases() is
  'Cron janitor: clears expired leases (and orphaned locked_by) on unprocessed domain_events rows so checkout can reclaim them (R27-AC02, OAC-07).';

revoke all on function public.domain_events_release_stale_leases() from public;
revoke all on function public.domain_events_release_stale_leases() from authenticated;
revoke all on function public.domain_events_release_stale_leases() from anon;

grant execute on function public.domain_events_release_stale_leases() to service_role;
