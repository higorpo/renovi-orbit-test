-- Service completion Task 37: service_completion_auto_complete_executed (design §4.5).
-- service_role batch: EXECUTED past grace → COMPLETED completed_by=system; no rating.
-- MMD SERVICE_AUTO_COMPLETED (routing/template hardening: Task 42). pgTAP: Task 70.

create or replace function public.service_completion_auto_complete_executed(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_batch_size int;
  v_grace_hours int;
  v_cutoff timestamptz;
  v_row record;
  v_completed jsonb := '[]'::jsonb;
  v_errors int := 0;
  v_error_samples jsonb := '[]'::jsonb;
  v_completed_at timestamptz;
  v_cs public.contracted_services%rowtype;
  v_schedule_id uuid;
  v_title text;
  v_mmd jsonb;
  v_executed_late boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_auto_complete_executed'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(p_batch_size, public.platform_constant_int('auto_complete_batch_size', 100)),
    1
  );
  v_grace_hours := public.platform_constant_int('auto_complete_grace_hours', 24);
  -- Sargable cutoff: compare executed_at to a constant, not executed_at + interval.
  v_cutoff := now() - make_interval(hours => v_grace_hours);

  for v_row in
    select cs.id
    from public.contracted_services cs
    where cs.status = 'EXECUTED'::public.contracted_service_status
      and cs.executed_at is not null
      and cs.executed_at <= v_cutoff
    order by cs.executed_at
    for update of cs skip locked
    limit v_batch_size
  loop
    begin
      v_completed_at := now();

      update public.contracted_services cs
      set
        status = 'COMPLETED'::public.contracted_service_status,
        completed_at = v_completed_at,
        completed_by = 'system'
      where cs.id = v_row.id
        and cs.status = 'EXECUTED'::public.contracted_service_status
      returning * into v_cs;

      if not found then
        continue;
      end if;

      -- Preserve executed_late on frozen evidence (do not mutate package).
      select ev.executed_late
      into v_executed_late
      from public.contracted_service_completion_evidence ev
      where ev.contracted_service_id = v_cs.id
        and ev.phase = 'frozen'::public.completion_evidence_phase;

      select ps.id
      into v_schedule_id
      from public.payment_schedules ps
      where ps.contracted_service_id = v_cs.id
      order by ps.created_at desc
      limit 1;

      if v_schedule_id is not null then
        perform public.payment_write_audit(
          p_event_type := 'SERVICE_AUTO_COMPLETED',
          p_entity_type := 'payment_schedule',
          p_entity_id := v_schedule_id,
          p_service_id := v_cs.id,
          p_schedule_id := v_schedule_id,
          p_from_state := 'EXECUTED',
          p_to_state := 'COMPLETED',
          p_actor := 'system'::public.payment_audit_actor,
          p_metadata := jsonb_build_object(
            'executed_at', v_cs.executed_at,
            'completed_by', 'system',
            'executed_late', v_executed_late,
            'source', 'service_completion_auto_complete_executed'
          )
        );

        perform public.payment_write_event(
          p_event_type := 'ServiceCompleted',
          p_aggregate_type := 'payment_schedule',
          p_aggregate_id := v_schedule_id,
          p_service_id := v_cs.id,
          p_payload := jsonb_build_object(
            'completed_by', 'system',
            'executed_at', v_cs.executed_at,
            'executed_late', v_executed_late
          )
        );
      end if;

      select coalesce(nullif(trim(sr.title), ''), 'Serviço')
      into v_title
      from public.service_requests sr
      where sr.id = v_cs.service_request_id;

      v_mmd := public.mmd_ingest_event(
        'SERVICE_AUTO_COMPLETED',
        v_cs.client_id,
        format('service_completion:%s:auto_completed', v_cs.id),
        jsonb_build_object(
          'service_id', v_cs.id,
          'provider_id', v_cs.provider_id,
          'client_id', v_cs.client_id,
          'completed_by', 'system',
          'optional_rating_cta', true,
          'executed_late', v_executed_late,
          'service_request_title', v_title,
          'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
        ),
        jsonb_build_object(
          'source', 'service_completion_auto_complete_executed',
          'recipient', 'client'
        )
      );

      v_completed := v_completed || jsonb_build_array(
        jsonb_build_object(
          'contracted_service_id', v_cs.id,
          'schedule_id', v_schedule_id,
          'client_id', v_cs.client_id,
          'provider_id', v_cs.provider_id,
          'executed_at', v_cs.executed_at,
          'completed_at', v_completed_at,
          'completed_by', 'system',
          'executed_late', v_executed_late,
          'mmd', v_mmd
        )
      );
    exception
      when others then
        v_errors := v_errors + 1;
        v_error_samples := v_error_samples || jsonb_build_array(
          jsonb_build_object(
            'contracted_service_id', v_row.id,
            'sqlstate', sqlstate,
            'message', public.sanitize_job_error(sqlerrm)
          )
        );
        raise warning
          'service_completion_auto_complete_executed row failed cs_id=% sqlstate=% message=%',
          v_row.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'scanned_limit', v_batch_size,
    'completed_count', jsonb_array_length(v_completed),
    'completed', v_completed,
    'errors_count', v_errors,
    'error_samples', v_error_samples,
    'grace_hours', v_grace_hours
  );
end;
$$;

comment on function public.service_completion_auto_complete_executed(int) is
  'service_role batch: EXECUTED past auto_complete_grace_hours → COMPLETED completed_by=system; no rating; MMD auto_completed (Task 37).';

revoke all on function public.service_completion_auto_complete_executed(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_auto_complete_executed(int)
  to service_role;
grant execute on function public.service_completion_auto_complete_executed(int)
  to postgres;
