-- pgTAP: record_domain_event helper (CNS task 23, design §3.8).

begin;

\ir fixture_seed_chat.sql

select plan(6);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_domain_event'
  ),
  'record_domain_event is SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_domain_event(text,text,uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute record_domain_event'
);

select throws_ok(
  $sql$
    select public.record_domain_event(
      'NOT_A_REAL_EVENT',
      'service_request',
      gen_random_uuid()
    );
  $sql$,
  '22023',
  'UNKNOWN_DOMAIN_EVENT_TYPE: NOT_A_REAL_EVENT',
  'rejects unknown event_type'
);

select throws_ok(
  $sql$
    select public.record_domain_event(
      'CHAT_MESSAGE_SENT',
      'chat_message',
      gen_random_uuid(),
      null,
      null,
      '{}'::jsonb
    );
  $sql$,
  '22023',
  'payload.idempotency_key required for notification event CHAT_MESSAGE_SENT',
  'requires idempotency_key for notification events'
);

select ok(
  (
    with seeded as (
      select pg_temp.cns_seed_chat(
        p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
        p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
        p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      ) as chat_id
    ),
    inserted as (
      select public.record_domain_event(
        'SLOT_RELEASED',
        'chat',
        s.chat_id,
        '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
        s.chat_id,
        jsonb_build_object('active_chat_count', 0)
      ) as event_id
      from seeded s
    )
    select exists (
      select 1
      from public.domain_events de
      join inserted i on i.event_id = de.id
      where de.event_type = 'SLOT_RELEASED'
        and de.processed_at is null
        and de.dead_letter = false
    )
  ),
  'inserts SLOT_RELEASED outbox row in same transaction'
);

select ok(
  (
    with seeded as (
      select pg_temp.cns_seed_chat(
        p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
        p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
        p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
      ) as chat_id
    )
    select public.record_domain_event(
      'CHATS_CLOSED_BULK',
      'service_request',
      '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
      '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
      null,
      jsonb_build_object(
        'idempotency_key', 'sr:7017e457:chats_closed_bulk',
        'chat_ids', (select jsonb_build_array(chat_id) from seeded),
        'closed_count', 1
      )
    ) is not null
  ),
  'accepts CHATS_CLOSED_BULK with chat_ids and idempotency_key'
);

select finish();

rollback;
