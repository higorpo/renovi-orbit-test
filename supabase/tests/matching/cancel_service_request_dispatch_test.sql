-- pgTAP: cancel_service_request DISPATCH_CANCELLED terminal (matching M14d).

begin;

select plan(3);

\ir ../chats/fixtures/seed_chat.inc

create or replace function pg_temp.cns_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create temp table _cancel_dispatch_sr as
select gen_random_uuid() as service_request_id;

insert into public.service_requests (
  id,
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
  (select service_request_id from _cancel_dispatch_sr),
  sr.client_id,
  sr.service_id,
  sr.address_id,
  'cancel dispatch pgTAP fixture',
  sr.description,
  sr.form_data,
  sr.form_version,
  'OPEN'::public.service_request_status,
  sr.urgency
from public.service_requests sr
where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values (
  (select service_request_id from _cancel_dispatch_sr),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'batch',
  now()
);

insert into message_dispatcher.message_dispatcher_user_limits (profile_id)
values ('5d09e025-20a2-4842-aeef-324d42a431e1'::uuid)
on conflict (profile_id) do nothing;

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  template_variables,
  status
)
values (
  gen_random_uuid(),
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'email'::message_dispatcher.message_channel,
  'matching.new_opportunity',
  jsonb_build_object(
    'service_request_id', (select service_request_id from _cancel_dispatch_sr),
    'title', 'Cancel dispatch test',
    'service_name', 'Eletricista',
    'neighborhood', 'Centro',
    'urgency', 'medium',
    'deep_link_path', format('/dashboard/services/%s', (select service_request_id from _cancel_dispatch_sr))
  ),
  'QUEUED'::message_dispatcher.message_dispatch_status
);

select pg_temp.cns_set_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select public.cancel_service_request(
  (select service_request_id from _cancel_dispatch_sr),
  gen_random_uuid()
);

select is(
  (
    select d.status::text
    from public.service_request_dispatches d
    where d.service_request_id = (select service_request_id from _cancel_dispatch_sr)
  ),
  'DISPATCH_CANCELLED',
  'cancel_service_request sets dispatch status to DISPATCH_CANCELLED'
);

select ok(
  (
    select v.revoked_at is not null
    from public.service_request_provider_visibility v
    where v.service_request_id = (select service_request_id from _cancel_dispatch_sr)
      and v.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ),
  'cancel_service_request revokes batch feed visibility'
);

select is(
  (
    select count(*)::int
    from message_dispatcher.message_dispatches md
    where md.template_key = 'matching.new_opportunity'
      and md.template_variables->>'service_request_id'
        = (select service_request_id from _cancel_dispatch_sr)::text
      and md.status = 'CANCELED'::message_dispatcher.message_dispatch_status
  ),
  1,
  'cancel_service_request cancels pending matching MMD rows'
);

select finish();

rollback;
