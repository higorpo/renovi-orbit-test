-- pgTAP: rpc_idempotency_records for actor helpers and request quote hash.

begin;

select plan(4);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.idempotency_begin_for_actor(uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute idempotency_begin_for_actor'
);

select is(
  public.request_quote_order_request_hash(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '{"kind":"existing","addressId":"a1"}'::jsonb,
    'Pedido teste',
    'Descrição',
    '{"field":"v"}'::jsonb,
    'v1',
    '{}'::jsonb,
    2,
    1024
  ),
  public.request_quote_order_request_hash(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '{"kind":"existing","addressId":"a1"}'::jsonb,
    'Pedido teste',
    'Descrição',
    '{"field":"v"}'::jsonb,
    'v1',
    '{}'::jsonb,
    2,
    1024
  ),
  'request_quote_order_request_hash is deterministic'
);

select lives_ok(
  $sql$
    select public.idempotency_commit_for_actor(
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'request_quote.create_order',
      'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
      'hash-order-v1',
      200,
      jsonb_build_object(
        'requestId', 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid,
        'addressId', 'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'::uuid
      )
    );
  $sql$,
  'commit_for_actor persists request quote order response'
);

select is(
  public.idempotency_begin_for_actor(
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    'request_quote.create_order',
    'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'hash-order-v1'
  )->'response_body'->>'requestId',
  'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'begin_for_actor replays cached request quote order'
);

select finish();

rollback;
