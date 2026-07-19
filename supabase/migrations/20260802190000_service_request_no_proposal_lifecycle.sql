-- Client notifications + auto-cancel for OPEN service requests with zero proposals.
-- 24h: push "still seeking quotes"; 48h: push+email + system cancel (client can republish).

insert into public.platform_constants (key, value, description)
values
  (
    'matching.no_proposal_seeking_hours',
    '24'::jsonb,
    'Hours after OPEN creation without any proposal before seeking-quotes push to the client.'
  ),
  (
    'matching.no_proposal_auto_cancel_hours',
    '48'::jsonb,
    'Hours after OPEN creation without any proposal before auto-cancel + push/email to the client.'
  ),
  (
    'matching.no_proposal_lifecycle_batch_size',
    '100'::jsonb,
    'Max OPEN service requests processed per no-proposal lifecycle cron tick.'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

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
    'matching.no_proposal_seeking',
    'push',
    'Ainda buscando orçamentos',
    'Continuamos buscando prestadores para {{service_request_title}}. Avisaremos assim que houver novidades.',
    '{
      "type": "object",
      "properties": {
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["service_request_id", "service_request_title", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'matching.no_proposal_auto_cancelled',
    'push',
    'Pedido encerrado sem orçamentos',
    'Não encontramos prestadores para {{service_request_title}}. Você pode republicar ou melhorar o pedido.',
    '{
      "type": "object",
      "properties": {
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["service_request_id", "service_request_title", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'matching.no_proposal_auto_cancelled',
    'email',
    'Não encontramos prestadores para {{service_request_title}}',
    '<p>Não foi possível encontrar nenhum prestador para o pedido <strong>{{service_request_title}}</strong> dentro do prazo.</p>'
      || '<p>Encerramos o pedido automaticamente. Você pode <strong>republicá-lo</strong> ou ajustar a descrição, fotos e detalhes para melhorar as chances na próxima busca.</p>'
      || '<p><a href="{{deep_link_path}}">Abrir pedido e republicar</a></p>',
    '{
      "type": "object",
      "properties": {
        "service_request_id": { "type": "string", "format": "uuid" },
        "service_request_title": { "type": "string" },
        "deep_link_path": { "type": "string" }
      },
      "required": ["service_request_id", "service_request_title", "deep_link_path"],
      "additionalProperties": false
    }'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

create index if not exists service_requests_open_created_at_idx
  on public.service_requests (created_at)
  where status = 'OPEN'::public.service_request_status;

-- System cancel for OPEN SRs with zero proposals (service_role / cron only).
create or replace function public.system_cancel_service_request_no_proposals(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sr public.service_requests%rowtype;
  v_dispatch public.service_request_dispatches%rowtype;
  v_chat_ids jsonb;
begin
  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id
  for update;

  if not found then
    raise exception 'Service request not found: %', p_service_request_id
      using errcode = '22023';
  end if;

  if v_sr.status <> 'OPEN'::public.service_request_status then
    return jsonb_build_object(
      'cancelled', false,
      'reason', 'not_open',
      'service_request_id', v_sr.id
    );
  end if;

  if exists (
    select 1
    from public.provider_proposals pp
    where pp.service_request_id = v_sr.id
  ) then
    return jsonb_build_object(
      'cancelled', false,
      'reason', 'has_proposals',
      'service_request_id', v_sr.id
    );
  end if;

  perform 1
  from public.provider_proposals pp
  where pp.service_request_id = v_sr.id
  for update;

  perform public.reject_non_terminal_proposals_on_sr_cancel(v_sr.id);

  select *
  into v_dispatch
  from public.service_request_dispatches d
  where d.service_request_id = v_sr.id
  for update;

  if found
    and v_dispatch.status not in (
      'DISPATCH_MATCHED'::public.service_request_dispatch_status,
      'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      'DISPATCH_EXPIRED'::public.service_request_dispatch_status
    )
  then
    insert into public.service_request_dispatch_events (
      dispatch_id,
      service_request_id,
      event_type,
      payload
    )
    values (
      v_dispatch.id,
      v_sr.id,
      'state_transition',
      jsonb_build_object(
        'from', v_dispatch.status,
        'to', 'DISPATCH_CANCELLED',
        'reason', 'no_proposal_auto_cancel'
      )
    );

    update public.service_request_dispatches
    set
      status = 'DISPATCH_CANCELLED'::public.service_request_dispatch_status,
      next_batch_at = null,
      updated_at = now()
    where id = v_dispatch.id;
  end if;

  update public.service_request_provider_visibility v
  set revoked_at = now()
  where v.service_request_id = v_sr.id
    and v.revoked_at is null;

  perform public.matching_cancel_pending_mmd_for_service_request(v_sr.id);

  update public.service_requests
  set
    status = 'CANCELLED'::public.service_request_status,
    cancelled_at = now(),
    updated_at = now()
  where id = v_sr.id
  returning * into v_sr;

  with closed as (
    update public.chats c
    set
      status = 'CLOSED'::public.cns_conversation_status,
      closure_type = 'SERVICE_REQUEST_CANCELLED'::public.cns_closure_type,
      closed_at = now(),
      closed_by_user_id = null,
      updated_at = now()
    where c.service_request_id = v_sr.id
      and c.status <> 'CLOSED'::public.cns_conversation_status
    returning c.id
  )
  select coalesce(jsonb_agg(to_jsonb(closed.id)), '[]'::jsonb)
  into v_chat_ids
  from closed;

  update public.service_request_negotiation_stats
  set
    active_chat_count = 0,
    version = version + 1
  where service_request_id = v_sr.id;

  raise log 'system_cancel_service_request_no_proposals service_request_id=% closed_chats=%',
    v_sr.id,
    jsonb_array_length(v_chat_ids);

  return jsonb_build_object(
    'cancelled', true,
    'service_request', jsonb_build_object(
      'id', v_sr.id,
      'client_id', v_sr.client_id,
      'status', v_sr.status,
      'cancelled_at', v_sr.cancelled_at
    )
  );
end;
$$;

comment on function public.system_cancel_service_request_no_proposals(uuid) is
  'System cancel for OPEN service requests with zero proposals (no-proposal lifecycle cron).';

revoke all on function public.system_cancel_service_request_no_proposals(uuid)
  from public, anon, authenticated;
grant execute on function public.system_cancel_service_request_no_proposals(uuid)
  to service_role, postgres;

create or replace function public.process_service_requests_without_proposals(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_batch_size int;
  v_seeking_hours int;
  v_cancel_hours int;
  v_processed int := 0;
  v_seeking_notified int := 0;
  v_cancelled int := 0;
  v_skipped int := 0;
  v_error_count int := 0;
  v_row record;
  v_deep_link text;
  v_variables jsonb;
  v_idempotency_text text;
  v_cancel_result jsonb;
  v_channel message_dispatcher.message_channel;
  v_channels message_dispatcher.message_channel[];
begin
  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('matching.no_proposal_lifecycle_batch_size', 100)
    ),
    1
  );

  if v_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500'
      using errcode = '22023';
  end if;

  v_seeking_hours := public.platform_constant_int('matching.no_proposal_seeking_hours', 24);
  v_cancel_hours := public.platform_constant_int('matching.no_proposal_auto_cancel_hours', 48);

  if v_cancel_hours < v_seeking_hours then
    raise exception 'matching.no_proposal_auto_cancel_hours must be >= matching.no_proposal_seeking_hours'
      using errcode = '22023';
  end if;

  perform public.cns_set_local_statement_timeout('120s');

  for v_row in
    select
      sr.id,
      sr.client_id,
      sr.title,
      sr.created_at
    from public.service_requests sr
    where sr.status = 'OPEN'::public.service_request_status
      and not exists (
        select 1
        from public.provider_proposals pp
        where pp.service_request_id = sr.id
      )
      and (
        sr.created_at <= now() - make_interval(hours => v_cancel_hours)
        or (
          sr.created_at <= now() - make_interval(hours => v_seeking_hours)
          and not exists (
            select 1
            from message_dispatcher.message_dispatches d
            where d.idempotency_key = public.mmd_idempotency_uuid(
              format('service_request:%s:no_proposal_seeking:push', sr.id)
            )
          )
        )
      )
    order by sr.created_at
    limit v_batch_size
    for update of sr skip locked
  loop
    begin
      v_processed := v_processed + 1;
      v_deep_link := format('/dashboard/services/%s', v_row.id);
      v_variables := jsonb_build_object(
        'service_request_id', v_row.id,
        'service_request_title', coalesce(nullif(btrim(v_row.title), ''), 'Seu pedido'),
        'deep_link_path', v_deep_link
      );

      if v_row.created_at <= now() - make_interval(hours => v_cancel_hours) then
        v_cancel_result := public.system_cancel_service_request_no_proposals(v_row.id);

        if coalesce((v_cancel_result->>'cancelled')::boolean, false) is not true then
          v_skipped := v_skipped + 1;
          continue;
        end if;

        v_cancelled := v_cancelled + 1;
        v_channels := array[
          'push'::message_dispatcher.message_channel,
          'email'::message_dispatcher.message_channel
        ];

        foreach v_channel in array v_channels loop
          v_idempotency_text := format(
            'service_request:%s:no_proposal_auto_cancelled:%s',
            v_row.id,
            v_channel::text
          );

          begin
            perform message_dispatcher.message_dispatcher_ingest(
              public.mmd_idempotency_uuid(v_idempotency_text),
              v_row.client_id,
              v_channel,
              'matching.no_proposal_auto_cancelled',
              v_variables,
              now(),
              'matching',
              jsonb_build_object(
                'source', 'process_service_requests_without_proposals',
                'phase', 'auto_cancel',
                'idempotency_key', v_idempotency_text
              ),
              true
            );
          exception
            when others then
              raise log 'no_proposal_auto_cancel_notify_skip service_request_id=% channel=% sqlstate=% message=%',
                v_row.id,
                v_channel,
                sqlstate,
                sqlerrm;
          end;
        end loop;

        continue;
      end if;

      -- 24h seeking push (before auto-cancel window)
      v_idempotency_text := format(
        'service_request:%s:no_proposal_seeking:push',
        v_row.id
      );

      if exists (
        select 1
        from message_dispatcher.message_dispatches d
        where d.idempotency_key = public.mmd_idempotency_uuid(v_idempotency_text)
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      perform message_dispatcher.message_dispatcher_ingest(
        public.mmd_idempotency_uuid(v_idempotency_text),
        v_row.client_id,
        'push'::message_dispatcher.message_channel,
        'matching.no_proposal_seeking',
        v_variables,
        now(),
        'matching',
        jsonb_build_object(
          'source', 'process_service_requests_without_proposals',
          'phase', 'seeking',
          'idempotency_key', v_idempotency_text
        ),
        true
      );

      v_seeking_notified := v_seeking_notified + 1;
    exception
      when others then
        v_error_count := v_error_count + 1;
        raise log 'process_service_requests_without_proposals row_error service_request_id=% sqlstate=% message=%',
          v_row.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'processed_count', v_processed,
    'seeking_notified_count', v_seeking_notified,
    'cancelled_count', v_cancelled,
    'skipped_count', v_skipped,
    'error_count', v_error_count,
    'seeking_hours', v_seeking_hours,
    'auto_cancel_hours', v_cancel_hours
  );
end;
$$;

comment on function public.process_service_requests_without_proposals(int) is
  'Notify clients at seeking hours and auto-cancel OPEN SRs with zero proposals at cancel hours.';

revoke all on function public.process_service_requests_without_proposals(int)
  from public, anon, authenticated;
grant execute on function public.process_service_requests_without_proposals(int)
  to service_role, postgres;

create or replace function public.cron_process_service_requests_without_proposals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'process_service_requests_without_proposals';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    v_result := public.process_service_requests_without_proposals();
    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      coalesce((v_result->>'processed_count')::int, 0),
      coalesce((v_result->>'seeking_notified_count')::int, 0)
        + coalesce((v_result->>'cancelled_count')::int, 0),
      coalesce((v_result->>'error_count')::int, 0),
      v_result,
      null
    );
    return v_result;
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.cron_process_service_requests_without_proposals() is
  'pg_cron entrypoint: no-proposal seeking notify + auto-cancel with job_runs telemetry.';

revoke all on function public.cron_process_service_requests_without_proposals()
  from public, anon, authenticated;
grant execute on function public.cron_process_service_requests_without_proposals()
  to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'process_service_requests_without_proposals';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'process_service_requests_without_proposals',
  '*/15 * * * *',
  $$select public.cron_process_service_requests_without_proposals();$$
);
