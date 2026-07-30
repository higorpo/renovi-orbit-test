-- pgTAP: matching_cancel_pending_mmd_for_service_request (matching M11c).

begin;

select plan(3);

create temp table _cancel_mmd_sr as
select '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid as service_request_id;

-- Clear leftover matching.new_opportunity rows from seeds/crons for this SR.
do $$
begin
  perform public.matching_cancel_pending_mmd_for_service_request(
    (select service_request_id from _cancel_mmd_sr)
  );
end;
$$;

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
select p.id
from public.profiles p
where p.id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
on conflict (profile_id) do nothing;

create temp table _cancel_mmd_rows as
select
  gen_random_uuid() as queued_dispatch_id,
  gen_random_uuid() as delivered_dispatch_id;

insert into message_dispatcher.message_dispatches (
  id,
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  status
)
select
  r.queued_dispatch_id,
  gen_random_uuid(),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'push'::message_dispatcher.message_channel,
  'matching.new_opportunity',
  jsonb_build_object(
    'service_request_id', (select service_request_id from _cancel_mmd_sr),
    'title', 'Cancel helper test',
    'service_name', 'Eletricista',
    'neighborhood', 'Centro',
    'urgency', 'medium',
    'deep_link_path', format('/dashboard/services/%s', (select service_request_id from _cancel_mmd_sr))
  ),
  'QUEUED'::message_dispatcher.message_dispatch_status
from _cancel_mmd_rows r
union all
select
  r.delivered_dispatch_id,
  gen_random_uuid(),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'email'::message_dispatcher.message_channel,
  'matching.new_opportunity',
  jsonb_build_object(
    'service_request_id', (select service_request_id from _cancel_mmd_sr),
    'title', 'Cancel helper test',
    'service_name', 'Eletricista',
    'neighborhood', 'Centro',
    'urgency', 'medium',
    'deep_link_path', format('/dashboard/services/%s', (select service_request_id from _cancel_mmd_sr))
  ),
  'DELIVERED'::message_dispatcher.message_dispatch_status
from _cancel_mmd_rows r;

select is(
  public.matching_cancel_pending_mmd_for_service_request(
    (select service_request_id from _cancel_mmd_sr)
  ),
  1,
  'pending matching dispatches are cancelled'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _cancel_mmd_rows r on d.id = r.queued_dispatch_id
  ),
  'CANCELED',
  'queued row transitions to CANCELED'
);

select is(
  (
    select d.status::text
    from message_dispatcher.message_dispatches d
    join _cancel_mmd_rows r on d.id = r.delivered_dispatch_id
  ),
  'DELIVERED',
  'terminal delivered row is untouched'
);

select finish();

rollback;
