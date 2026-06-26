-- pgTAP: payment Task 5 — shared payment enum types (design.md §2.3).

begin;

select plan(10);

select ok(
  to_regtype('public.payment_gateway_slug') is not null,
  'payment_gateway_slug enum exists'
);

select ok(
  to_regtype('public.payment_schedule_state') is not null,
  'payment_schedule_state enum exists'
);

select ok(
  to_regtype('public.payment_client_card_token_state') is not null,
  'payment_client_card_token_state enum exists'
);

select ok(
  to_regtype('public.payment_provider_onboarding_status') is not null,
  'payment_provider_onboarding_status enum exists'
);

select ok(
  to_regtype('public.payment_attempt_initiator') is not null,
  'payment_attempt_initiator enum exists'
);

select ok(
  to_regtype('public.payment_attempt_outcome') is not null,
  'payment_attempt_outcome enum exists'
);

select ok(
  to_regtype('public.payment_webhook_event_state') is not null,
  'payment_webhook_event_state enum exists'
);

select ok(
  to_regtype('public.payment_webhook_queue_state') is not null,
  'payment_webhook_queue_state enum exists'
);

select ok(
  to_regtype('public.payment_audit_actor') is not null,
  'payment_audit_actor enum exists'
);

select is(
  (
    select count(*)::int
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'
      and t.typname like 'payment\_%'
  ),
  9,
  'creates nine payment enum types'
);

select finish();

rollback;
