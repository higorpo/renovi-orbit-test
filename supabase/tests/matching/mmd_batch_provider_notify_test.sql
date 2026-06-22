-- pgTAP: matching batch_provider MMD ingest trigger (matching M11b).

begin;

select plan(4);

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
    'matching mmd trigger pgTAP fixture',
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

create temp table _notify_sr as
select pg_temp.matching_seed_open_service_request() as service_request_id;

create temp table _notify_dispatch as
select d.id as dispatch_id
from public.service_request_dispatches d
where d.service_request_id = (select service_request_id from _notify_sr);

create temp table _notify_batch as
with ins as (
  insert into public.service_request_dispatch_batches (
    dispatch_id,
    batch_number,
    explored_h3_cells
  )
  values (
    (select dispatch_id from _notify_dispatch),
    1,
    '[]'::jsonb
  )
  returning id as batch_id, batch_number
)
select batch_id, batch_number
from ins;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
values ('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid)
on conflict (profile_id) do nothing;

insert into public.service_request_dispatch_batch_providers (
  batch_id,
  provider_id,
  ranking_score,
  score_components,
  device_id
)
values (
  (select batch_id from _notify_batch),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  0.7500,
  '{"primary_score": 0.75}'::jsonb,
  null
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches md
    where md.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id::text from _notify_sr)
  ),
  2,
  'batch_provider insert enqueues push and email dispatches'
);

select is(
  (
    select array_agg(md.channel::text order by md.channel::text)
    from message_dispatcher.message_dispatches md
    where md.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id::text from _notify_sr)
  ),
  array['email', 'push'],
  'MMD rows use push and email channels'
);

select is(
  (
    select md.template_variables->>'deep_link_path'
    from message_dispatcher.message_dispatches md
    where md.profile_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      and md.template_key = 'matching.new_opportunity'
      and md.channel = 'push'
      and md.template_variables->>'service_request_id'
        = (select service_request_id::text from _notify_sr)
    limit 1
  ),
  format(
    '/dashboard/services/%s',
    (select service_request_id from _notify_sr)
  ),
  'push deep_link_path opens service detail route'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_dispatches md
    where md.idempotency_key = public.mmd_idempotency_uuid(
      format(
        'dispatch:%s:batch:%s:provider:%s:push',
        (select service_request_id from _notify_sr),
        (select batch_number from _notify_batch),
        '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      )
    )
  )
  and exists (
    select 1
    from message_dispatcher.message_dispatches md
    where md.idempotency_key = public.mmd_idempotency_uuid(
      format(
        'dispatch:%s:batch:%s:provider:%s:email',
        (select service_request_id from _notify_sr),
        (select batch_number from _notify_batch),
        '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      )
    )
  ),
  'MMD idempotency keys follow dispatch batch provider channel format'
);

select finish();

rollback;
