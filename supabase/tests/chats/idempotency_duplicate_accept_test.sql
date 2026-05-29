-- pgTAP: idempotency_begin/commit duplicate accept replay (CNS task 24, Req. 14).

begin;

select plan(6);

select set_config(
  'request.jwt.claim.sub',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '28e30f1d-3c47-441f-94c6-76b6ea0db470'
  )::text,
  true
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'idempotency_begin'
  ),
  'idempotency_begin is SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.idempotency_begin(text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute idempotency_begin directly'
);

select is(
  public.idempotency_begin(
    'chats.accept_proposal',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'::uuid,
    'hash-accept-v1'
  ),
  null,
  'begin returns null when no cached accept response'
);

select lives_ok(
  $sql$
    select public.idempotency_commit(
      'chats.accept_proposal',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'::uuid,
      'hash-accept-v1',
      200,
      jsonb_build_object(
        'proposal_id', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
        'service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
        'status', 'ACCEPTED'
      )
    );
  $sql$,
  'commit persists accept response'
);

select is(
  public.idempotency_begin(
    'chats.accept_proposal',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'::uuid,
    'hash-accept-v1'
  ),
  jsonb_build_object(
    'hit', true,
    'response_status', 200,
    'response_body', jsonb_build_object(
      'proposal_id', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
      'service_request_id', '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
      'status', 'ACCEPTED'
    )
  ),
  'duplicate accept begin returns cached response (R14-AC01)'
);

select throws_ok(
  $sql$
    select public.idempotency_begin(
      'chats.accept_proposal',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99'::uuid,
      'hash-accept-v2'
    );
  $sql$,
  'P0001',
  'IDEMPOTENCY_CONFLICT',
  'mismatched request_hash raises conflict'
);

select finish();

rollback;
