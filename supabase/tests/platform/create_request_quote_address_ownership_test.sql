-- pgTAP: create_request_quote_service_request rejects foreign or inactive addresses.

begin;

select plan(3);

select set_config('test.client_a_id', '28e30f1d-3c47-441f-94c6-76b6ea0db470', true);
select set_config('test.client_b_id', '38e30f1d-3c47-441f-94c6-76b6ea0db471', true);
select set_config('test.client_a_address_id', 'acd13138-0d54-431f-a672-55903f31301e', true);
select set_config('test.client_b_address_id', 'bcd13138-0d54-431f-a672-55903f31301f', true);
select set_config('test.service_id', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', true);

select throws_ok(
  format(
    $sql$
      select public.create_request_quote_service_request(
        '%s'::uuid,
        gen_random_uuid(),
        'hash-foreign-address',
        '%s'::uuid,
        '%s'::uuid,
        'Pedido teste',
        'Descrição do pedido',
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
      );
    $sql$,
    current_setting('test.client_a_id'),
    current_setting('test.client_b_address_id'),
    current_setting('test.service_id')
  ),
  '42501',
  'address does not belong to actor or is inactive',
  'rejects address owned by another client'
);

update public.client_addresses
set is_active = false
where id = current_setting('test.client_a_address_id')::uuid;

select throws_ok(
  format(
    $sql$
      select public.create_request_quote_service_request(
        '%s'::uuid,
        gen_random_uuid(),
        'hash-inactive-address',
        '%s'::uuid,
        '%s'::uuid,
        'Pedido teste',
        'Descrição do pedido',
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
      );
    $sql$,
    current_setting('test.client_a_id'),
    current_setting('test.client_a_address_id'),
    current_setting('test.service_id')
  ),
  '42501',
  'address does not belong to actor or is inactive',
  'rejects inactive address owned by actor'
);

update public.client_addresses
set is_active = true
where id = current_setting('test.client_a_address_id')::uuid;

select lives_ok(
  format(
    $sql$
      select public.create_request_quote_service_request(
        '%s'::uuid,
        gen_random_uuid(),
        'hash-own-address',
        '%s'::uuid,
        '%s'::uuid,
        'Pedido teste',
        'Descrição do pedido',
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
      );
    $sql$,
    current_setting('test.client_a_id'),
    current_setting('test.client_a_address_id'),
    current_setting('test.service_id')
  ),
  'creates service request when address belongs to actor'
);

select finish();

rollback;
