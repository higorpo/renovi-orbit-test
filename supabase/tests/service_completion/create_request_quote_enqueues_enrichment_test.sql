-- pgTAP: Task 14 — create_request_quote_service_request → PENDING enrichment, zero dispatch.

begin;

select plan(3);

select set_config('test.client_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('test.address_id', 'acd13138-0d54-431f-a672-55903f31301e', true);
select set_config('test.service_id', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', true);
select set_config('test.idem_key', gen_random_uuid()::text, true);

select lives_ok(
  format(
    $sql$
      select set_config(
        'test.created_sr_id',
        (
          select (public.create_request_quote_service_request(
            '%s'::uuid,
            '%s'::uuid,
            'hash-enqueue-enrichment-task14',
            '%s'::uuid,
            '%s'::uuid,
            'Pedido enrichment',
            'Descrição para enrichment enqueue',
            null,
            '{}'::jsonb,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          )->>'requestId')
        ),
        true
      )
    $sql$,
    current_setting('test.client_id'),
    current_setting('test.idem_key'),
    current_setting('test.address_id'),
    current_setting('test.service_id')
  ),
  'create_request_quote_service_request succeeds'
);

select ok(
  exists (
    select 1
    from public.service_request_enrichments e
    where e.service_request_id = current_setting('test.created_sr_id')::uuid
      and e.status = 'PENDING'::public.enrichment_status
      and e.correlation_id = current_setting('test.idem_key')::uuid
  ),
  'create enqueues PENDING enrichment with idempotency correlation_id'
);

select is(
  (
    select count(*)::int
    from public.service_request_dispatches d
    where d.service_request_id = current_setting('test.created_sr_id')::uuid
  ),
  0,
  'create does not bootstrap matching dispatch (OPEN trigger dropped)'
);

select finish();

rollback;
