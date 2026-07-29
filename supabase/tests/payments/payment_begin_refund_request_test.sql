-- pgTAP: payment_begin_refund_request dropped; refund amount helper remains.

begin;

select plan(6);

select ok(
  (
    select not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'payment_begin_refund_request'
    )
  ),
  'payment_begin_refund_request is dropped (callers use prepare/commit)'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '72 hours',
    'client'
  )->>'penalty_tier',
  'FULL_REFUND',
  'client refund >48h before service is FULL_REFUND tier'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '72 hours',
    'client'
  )->>'refund_amount',
  '110.00',
  'client refund >48h returns full charge_amount including card fees'
);

select is(
  public.payment_calculate_refund_amount(
    110.00,
    100.00,
    now() + interval '1 hour',
    'provider'
  )->>'refund_amount',
  '110.00',
  'provider-initiated refund returns full charge_amount'
);

select is(
  public.payment_calculate_refund_amount(
    50.00,
    100.00,
    now() + interval '1 hour',
    'client'
  )->>'refund_amount',
  '50.00',
  'CHK-042g: penalty tier refund is clamped with LEAST to charge_amount'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_prepare_refund_request'
  ),
  'payment_prepare_refund_request is SECURITY DEFINER'
);

select finish();

rollback;
