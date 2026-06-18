-- Matching M11a — MMD template seed for batch notifications (design §5.4, §15.5).

insert into message_dispatcher.message_templates (
  template_key,
  channel,
  subject_template,
  body_template,
  variable_schema,
  active
)
values
  (
    'matching.new_opportunity',
    'push',
    'Nova oportunidade',
    '{{title}} em {{neighborhood}}',
    '{
      "type": "object",
      "properties": {
        "service_request_id": { "type": "string", "format": "uuid" },
        "title": { "type": "string" },
        "service_name": { "type": "string" },
        "neighborhood": { "type": "string" },
        "urgency": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": [
        "service_request_id",
        "title",
        "service_name",
        "neighborhood",
        "urgency",
        "deep_link_path"
      ],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'matching.new_opportunity',
    'email',
    'Nova oportunidade: {{title}}',
    '<p>Você recebeu uma nova oportunidade de serviço: <strong>{{title}}</strong>.</p>'
      || '<p>{{service_name}} · {{neighborhood}} · urgência {{urgency}}</p>'
      || '<p><a href="{{deep_link_path}}">Ver oportunidade</a></p>',
    '{
      "type": "object",
      "properties": {
        "service_request_id": { "type": "string", "format": "uuid" },
        "title": { "type": "string" },
        "service_name": { "type": "string" },
        "neighborhood": { "type": "string" },
        "urgency": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": [
        "service_request_id",
        "title",
        "service_name",
        "neighborhood",
        "urgency",
        "deep_link_path"
      ],
      "additionalProperties": false
    }'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

-- Matching M11b — batch_provider MMD ingest trigger (design §5.4, §15.5).

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
    'deep_link_path', '/dashboard/jobs'
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
  'AFTER INSERT on batch_providers: enqueue matching.new_opportunity push+email via MMD ingest.';

revoke all on function public.trg_fn_matching_batch_provider_notify() from public, anon, authenticated;

drop trigger if exists trg_matching_batch_provider_notify
  on public.service_request_dispatch_batch_providers;

create trigger trg_matching_batch_provider_notify
  after insert on public.service_request_dispatch_batch_providers
  for each row
  execute function public.trg_fn_matching_batch_provider_notify();

-- Matching M11c — cancel pending MMD rows on SR terminal transition (design §15.7).

create or replace function public.matching_cancel_pending_mmd_for_service_request(
  p_service_request_id uuid,
  p_template_prefix text default 'matching.'
)
returns int
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_prefix text := coalesce(nullif(btrim(p_template_prefix), ''), 'matching.');
  v_cancelled int;
begin
  if p_service_request_id is null then
    return 0;
  end if;

  update message_dispatcher.message_dispatches md
  set
    status = 'CANCELED'::message_dispatcher.message_dispatch_status,
    cancel_reason = v_prefix || 'service_request_terminal',
    updated_at = now()
  where md.status in (
    'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
    'SCHEDULED'::message_dispatcher.message_dispatch_status,
    'QUEUED'::message_dispatcher.message_dispatch_status,
    'PROCESSING'::message_dispatcher.message_dispatch_status,
    'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status
  )
    and md.template_key like v_prefix || '%'
    and md.template_variables->>'service_request_id' = p_service_request_id::text;

  get diagnostics v_cancelled = row_count;
  return coalesce(v_cancelled, 0);
end;
$$;

comment on function public.matching_cancel_pending_mmd_for_service_request(uuid, text) is
  'Cancels non-terminal matching MMD dispatches for a service request (accept/cancel hooks).';

revoke all on function public.matching_cancel_pending_mmd_for_service_request(uuid, text) from public;
grant execute on function public.matching_cancel_pending_mmd_for_service_request(uuid, text) to service_role;
