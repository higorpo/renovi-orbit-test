-- pgTAP: dispatch bootstrap trigger (matching M6).

begin;

select plan(5);

create or replace function pg_temp.matching_seed_open_service_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'matching bootstrap pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

create temp table _bootstrap_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _bootstrap_sr)
  ),
  'DISPATCH_PENDING',
  'first OPEN creates DISPATCH_PENDING dispatch row'
);

select ok(
  (
    select d.next_batch_at > now()
      and d.next_batch_at <= now() + interval '6 minutes'
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _bootstrap_sr)
  ),
  'next_batch_at scheduled after dispatch_start_delay_minutes'
);

update public.service_requests
set title = 'matching bootstrap pgTAP fixture updated'
where id = (select service_request_id from _bootstrap_sr);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _bootstrap_sr)
  ),
  1,
  'subsequent OPEN update does not create a second dispatch row'
);

select lives_ok(
  format(
    $$
    insert into public.service_request_dispatches (
      service_request_id,
      status,
      next_batch_at
    )
    values (
      %L::uuid,
      'DISPATCH_PENDING',
      now() + interval '5 minutes'
    )
    on conflict (service_request_id) do nothing
    $$,
    (select service_request_id from _bootstrap_sr)
  ),
  'concurrent bootstrap insert uses ON CONFLICT DO NOTHING'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _bootstrap_sr)
  ),
  1,
  'concurrent insert leaves exactly one dispatch row'
);

select finish();

rollback;
