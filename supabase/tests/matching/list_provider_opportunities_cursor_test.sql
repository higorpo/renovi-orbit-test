-- pgTAP: list_provider_opportunities sort + cursor (matching M12c).

begin;

select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);

create or replace function pg_temp.matching_seed_open_service_request(
  p_title text default 'matching cursor feed fixture'
)
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
    p_title,
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

create temp table _cursor_sr_a as
select pg_temp.matching_seed_open_service_request('matching cursor feed A') as service_request_id;

create temp table _cursor_sr_b as
select pg_temp.matching_seed_open_service_request('matching cursor feed B') as service_request_id;

insert into public.service_request_provider_visibility (
  service_request_id,
  provider_id,
  source,
  granted_at
)
values
  (
    (select service_request_id from _cursor_sr_a),
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
    'batch',
    now() - interval '2 hours'
  ),
  (
    (select service_request_id from _cursor_sr_b),
    '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
    'batch',
    now() - interval '1 hour'
  );

select throws_ok(
  $$
    select public.list_provider_opportunities(
      '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
      null,
      null,
      'newest',
      'not-a-valid-cursor',
      20
    )
  $$,
  '22023',
  null,
  'invalid cursor raises 22023'
);

select is(
  (
    select public.matching_decode_feed_cursor(
      public.matching_encode_feed_cursor(
        jsonb_build_object(
          'sort', 'least_competitive',
          'k1', 0,
          'sr_id', (select service_request_id from _cursor_sr_a)
        )
      )
    )->>'sort'
  ),
  'least_competitive',
  'cursor encode/decode preserves sort mode key'
);

create temp table _page1 as
select public.list_provider_opportunities(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  null,
  null,
  'newest',
  null,
  1
) as payload;

create temp table _page2 as
select public.list_provider_opportunities(
  '4cf92e3a-64cd-4491-998e-9163138f8e96'::uuid,
  null,
  null,
  'newest',
  (select payload->>'next_cursor' from _page1),
  1
) as payload;

select ok(
  (
    select jsonb_array_length(p1.payload->'items') = 1
      and jsonb_array_length(p2.payload->'items') = 1
      and (p1.payload->'items'->0->>'service_request_id')
        <> (p2.payload->'items'->0->>'service_request_id')
      and coalesce(p1.payload->>'has_more', 'false')::boolean
    from _page1 p1, _page2 p2
  ),
  'keyset pagination returns stable non-overlapping pages'
);

select finish();

rollback;
