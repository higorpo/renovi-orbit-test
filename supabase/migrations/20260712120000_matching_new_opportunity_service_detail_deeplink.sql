-- Matching: new_opportunity push deep link opens service detail (same pattern as chat deep links).

create or replace function public.trg_fn_matching_batch_provider_notify()
returns trigger
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_meta record;
  v_channel message_dispatcher.message_channel;
  v_channels constant message_dispatcher.message_channel[] := array[
    'push'::message_dispatcher.message_channel,
    'email'::message_dispatcher.message_channel
  ];
  v_idempotency_text text;
  v_variables jsonb;
  v_metadata jsonb;
begin
  select
    sr.id as service_request_id,
    sr.title,
    sr.urgency::text as urgency,
    ps.title as service_name,
    coalesce(nullif(btrim(ca.neighborhood), ''), '—') as neighborhood,
    b.batch_number,
    d.id as dispatch_id
  into v_meta
  from public.service_request_dispatch_batches b
  join public.service_request_dispatches d on d.id = b.dispatch_id
  join public.service_requests sr on sr.id = d.service_request_id
  join public.platform_services ps on ps.id = sr.service_id
  join public.client_addresses ca on ca.id = sr.address_id
  where b.id = new.batch_id;

  if not found then
    raise exception 'batch % not found for matching notification trigger', new.batch_id
      using errcode = 'P0001';
  end if;

  v_variables := jsonb_build_object(
    'service_request_id', v_meta.service_request_id,
    'title', v_meta.title,
    'service_name', v_meta.service_name,
    'neighborhood', v_meta.neighborhood,
    'urgency', v_meta.urgency,
    'deep_link_path', format('/dashboard/services/%s', v_meta.service_request_id)
  );

  v_metadata := jsonb_build_object(
    'source', 'matching_batch_provider_notify',
    'batch_id', new.batch_id,
    'dispatch_id', v_meta.dispatch_id,
    'device_id', new.device_id
  );

  foreach v_channel in array v_channels loop
    v_idempotency_text := format(
      'dispatch:%s:batch:%s:provider:%s:%s',
      v_meta.service_request_id,
      v_meta.batch_number,
      new.provider_id,
      v_channel::text
    );

    perform message_dispatcher.message_dispatcher_ingest(
      public.mmd_idempotency_uuid(v_idempotency_text),
      new.provider_id,
      v_channel,
      'matching.new_opportunity',
      v_variables,
      now(),
      'matching',
      v_metadata || jsonb_build_object('idempotency_key', v_idempotency_text),
      false
    );
  end loop;

  return new;
end;
$$;

comment on function public.trg_fn_matching_batch_provider_notify() is
  'AFTER INSERT on batch_providers: enqueue matching.new_opportunity push+email via MMD ingest; deep_link_path opens /dashboard/services/{service_request_id}.';
