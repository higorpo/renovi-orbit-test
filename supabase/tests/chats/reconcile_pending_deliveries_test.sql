-- pgTAP: cns_reconcile_pending_deliveries (design §8.1, task 51, R26-AC01, R13-AC03).

begin;

\ir fixtures/seed_chat.inc

select plan(6);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cns_reconcile_pending_deliveries'
  ),
  'cns_reconcile_pending_deliveries is SECURITY DEFINER'
);

select ok(
  has_function_privilege('service_role', 'public.cns_reconcile_pending_deliveries(int)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.cns_reconcile_pending_deliveries(int)', 'EXECUTE'),
  'service_role only may execute cns_reconcile_pending_deliveries'
);

create temp table _delivery_reconcile_fixture as
select
  pg_temp.cns_seed_chat(
    p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  ) as chat_id,
  gen_random_uuid() as stale_message_id,
  gen_random_uuid() as recent_message_id,
  gen_random_uuid() as sent_message_id;

insert into public.chat_messages (
  id,
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  delivery_status,
  created_at
)
select
  f.stale_message_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'stale pending'),
  gen_random_uuid(),
  'PENDING'::public.cns_delivery_status,
  now() - interval '6 minutes'
from _delivery_reconcile_fixture f;

insert into public.chat_messages (
  id,
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  delivery_status,
  created_at
)
select
  f.recent_message_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'recent pending'),
  gen_random_uuid(),
  'PENDING'::public.cns_delivery_status,
  now() - interval '2 minutes'
from _delivery_reconcile_fixture f;

insert into public.chat_messages (
  id,
  chat_id,
  sender_user_id,
  message_type,
  payload,
  idempotency_key,
  delivery_status,
  created_at
)
select
  f.sent_message_id,
  f.chat_id,
  '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
  'TEXT'::public.cns_message_type,
  jsonb_build_object('text', 'already sent'),
  gen_random_uuid(),
  'SENT'::public.cns_delivery_status,
  now() - interval '10 minutes'
from _delivery_reconcile_fixture f;

select is(
  (public.cns_reconcile_pending_deliveries(200)->>'reconciled_count')::int,
  1,
  'reconciles one stale PENDING message'
);

select is(
  (
    select m.delivery_status::text
    from public.chat_messages m
    join _delivery_reconcile_fixture f on m.id = f.stale_message_id
  ),
  'FAILED',
  'stale PENDING marked FAILED'
);

select ok(
  (
    select m.delivery_status::text
    from public.chat_messages m
    join _delivery_reconcile_fixture f on m.id = f.recent_message_id
  ) = 'PENDING',
  'recent PENDING left unchanged'
);

select ok(
  (
    select m.delivery_status::text
    from public.chat_messages m
    join _delivery_reconcile_fixture f on m.id = f.sent_message_id
  ) = 'SENT',
  'SENT message left unchanged'
);

select finish();

rollback;
