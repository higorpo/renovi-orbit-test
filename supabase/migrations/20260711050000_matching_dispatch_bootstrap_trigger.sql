-- Matching M6 — service request dispatch bootstrap trigger (design §4.1 M6, requirements 1.1).

create or replace function public.trg_fn_service_request_dispatch_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delay_minutes int;
  v_dispatch_id uuid;
begin
  if new.status is distinct from 'OPEN'::public.service_request_status then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status is not distinct from 'OPEN'::public.service_request_status then
    return new;
  end if;

  v_delay_minutes := public.platform_constant_int('matching.dispatch_start_delay_minutes', 5);

  insert into public.service_request_dispatches (
    service_request_id,
    status,
    next_batch_at
  )
  values (
    new.id,
    'DISPATCH_PENDING',
    now() + (v_delay_minutes || ' minutes')::interval
  )
  on conflict (service_request_id) do nothing
  returning id into v_dispatch_id;

  if v_dispatch_id is not null then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_dispatch_id,
      new.id,
      'state_transition',
      jsonb_build_object('bootstrap', true, 'to', 'DISPATCH_PENDING')
    );
  end if;

  return new;
end;
$$;

comment on function public.trg_fn_service_request_dispatch_bootstrap() is
  'AFTER INSERT/UPDATE on service_requests: bootstrap dispatch row on first transition to OPEN.';

revoke all on function public.trg_fn_service_request_dispatch_bootstrap() from public;

drop trigger if exists trg_service_request_dispatch_bootstrap on public.service_requests;
create trigger trg_service_request_dispatch_bootstrap
  after insert or update of status on public.service_requests
  for each row
  execute function public.trg_fn_service_request_dispatch_bootstrap();

-- Backfill dispatch rows for OPEN service requests created before matching bootstrap existed.
insert into public.service_request_dispatches (
  service_request_id,
  status,
  next_batch_at
)
select
  sr.id,
  'DISPATCH_PENDING'::public.service_request_dispatch_status,
  now() + (
    public.platform_constant_int('matching.dispatch_start_delay_minutes', 5) || ' minutes'
  )::interval
from public.service_requests sr
where sr.status = 'OPEN'::public.service_request_status
  and not exists (
    select 1
    from public.service_request_dispatches d
    where d.service_request_id = sr.id
  )
on conflict (service_request_id) do nothing;
