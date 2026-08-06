-- Auto-mark CONFIRMED → EXECUTED when provider misses schedule-end + grace (empty checklist).
-- Depends on: auto_executed_without_checklist (040600), platform constants (040100),
-- service_completion_scheduled_end_at (043000), context flag exposure (044500).

-- ---------------------------------------------------------------------------
-- Index for CONFIRMED eligibility (effective end date)
-- ---------------------------------------------------------------------------

create index if not exists contracted_services_confirmed_auto_mark_executed_idx
  on public.contracted_services (
    (coalesce(scheduled_end_date, scheduled_start_date))
  )
  where status = 'CONFIRMED'::public.contracted_service_status;

comment on index public.contracted_services_confirmed_auto_mark_executed_idx is
  'Partial index for service_completion_auto_mark_executed: CONFIRMED by coalesce(end, start).';

-- ---------------------------------------------------------------------------
-- Batch: auto-mark EXECUTED without checklist
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_auto_mark_executed(
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
  v_marked jsonb := '[]'::jsonb;
  v_errors int := 0;
  v_error_samples jsonb := '[]'::jsonb;
  v_cs public.contracted_services%rowtype;
  v_evidence public.contracted_service_completion_evidence%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_has_enrichment boolean;
  v_executed_late boolean;
  v_responses jsonb := '{}'::jsonb;
  v_responses_hash text;
  v_schema_hash text;
  v_idem text;
  v_schedule_id uuid;
  v_title text;
  v_mmd jsonb;
  v_frozen_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for service_completion_auto_mark_executed'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(p_batch_size, public.platform_constant_int('auto_mark_executed_batch_size', 100)),
    1
  );
  v_grace_hours := public.platform_constant_int('auto_mark_executed_grace_hours', 24);
  -- Eligible when scheduled_end_at + grace <= now() ⇔ scheduled_end_at <= now() - grace
  v_cutoff := now() - make_interval(hours => v_grace_hours);

  for v_row in
    select cs.id
    from public.contracted_services cs
    where cs.status = 'CONFIRMED'::public.contracted_service_status
      and public.service_completion_scheduled_end_at(
        cs.scheduled_start_date,
        cs.scheduled_end_date
      ) <= v_cutoff
    order by public.service_completion_scheduled_end_at(
      cs.scheduled_start_date,
      cs.scheduled_end_date
    )
    for update of cs skip locked
    limit v_batch_size
  loop
    begin
      v_frozen_at := now();
      v_idem := format('system-auto-executed:%s', v_row.id);
      v_responses := '{}'::jsonb;
      v_responses_hash := encode(
        extensions.digest(convert_to(v_responses::text, 'UTF8'), 'sha256'),
        'hex'
      );

      select cs.*
      into v_cs
      from public.contracted_services cs
      where cs.id = v_row.id
        and cs.status = 'CONFIRMED'::public.contracted_service_status
      for update;

      if not found then
        continue;
      end if;

      v_executed_late := public.service_completion_compute_executed_late(
        v_cs.scheduled_start_date,
        v_cs.scheduled_end_date
      );

      select e.*
      into v_enrichment
      from public.service_request_enrichments e
      where e.service_request_id = v_cs.service_request_id
        and e.status = 'READY'::public.enrichment_status;
      v_has_enrichment := found;

      if v_has_enrichment then
        v_schema_hash := encode(
          extensions.digest(convert_to(v_enrichment.checklist_schema::text, 'UTF8'), 'sha256'),
          'hex'
        );
      else
        v_schema_hash := null;
      end if;

      select ev.*
      into v_evidence
      from public.contracted_service_completion_evidence ev
      where ev.contracted_service_id = v_cs.id
      for update;

      if found then
        if v_evidence.phase is distinct from 'draft'::public.completion_evidence_phase then
          raise exception 'EVIDENCE_NOT_DRAFT'
            using errcode = 'P0001';
        end if;

        update public.contracted_service_completion_evidence
        set
          enrichment_id = case
            when v_has_enrichment then coalesce(enrichment_id, v_enrichment.id)
            else enrichment_id
          end,
          checklist_schema_hash = case
            when v_has_enrichment then coalesce(checklist_schema_hash, v_schema_hash)
            else checklist_schema_hash
          end,
          phase = 'frozen'::public.completion_evidence_phase,
          responses = v_responses,
          responses_hash = v_responses_hash,
          executed_late = v_executed_late,
          frozen_at = v_frozen_at,
          idempotency_key = v_idem,
          auto_executed_without_checklist = true,
          updated_at = now()
        where id = v_evidence.id
        returning * into v_evidence;
      else
        insert into public.contracted_service_completion_evidence (
          contracted_service_id,
          enrichment_id,
          checklist_schema_hash,
          phase,
          responses,
          draft_version,
          executed_late,
          responses_hash,
          frozen_at,
          idempotency_key,
          auto_executed_without_checklist
        )
        values (
          v_cs.id,
          case when v_has_enrichment then v_enrichment.id else null end,
          v_schema_hash,
          'frozen'::public.completion_evidence_phase,
          v_responses,
          1,
          v_executed_late,
          v_responses_hash,
          v_frozen_at,
          v_idem,
          true
        )
        returning * into v_evidence;
      end if;

      update public.completion_evidence_upload_sessions
      set status = 'committed', updated_at = now()
      where contracted_service_id = v_cs.id
        and status = 'open';

      update public.contracted_services cs
      set
        status = 'EXECUTED'::public.contracted_service_status,
        executed_at = v_frozen_at
      where cs.id = v_cs.id
        and cs.status = 'CONFIRMED'::public.contracted_service_status
      returning * into v_cs;

      if not found then
        continue;
      end if;

      select ps.id
      into v_schedule_id
      from public.payment_schedules ps
      where ps.contracted_service_id = v_cs.id
      order by ps.created_at desc
      limit 1;

      if v_schedule_id is not null then
        perform public.payment_write_audit(
          p_event_type := 'SERVICE_EXECUTED',
          p_entity_type := 'payment_schedule',
          p_entity_id := v_schedule_id,
          p_service_id := v_cs.id,
          p_schedule_id := v_schedule_id,
          p_from_state := 'CONFIRMED',
          p_to_state := 'EXECUTED',
          p_actor := 'system'::public.payment_audit_actor,
          p_metadata := jsonb_build_object(
            'executed_at', v_cs.executed_at,
            'executed_late', v_executed_late,
            'responses_hash', v_responses_hash,
            'evidence_id', v_evidence.id,
            'auto_executed_without_checklist', true,
            'source', 'service_completion_auto_mark_executed'
          )
        );

        perform public.payment_write_event(
          p_event_type := 'ServiceExecuted',
          p_aggregate_type := 'payment_schedule',
          p_aggregate_id := v_schedule_id,
          p_service_id := v_cs.id,
          p_payload := jsonb_build_object(
            'provider_id', v_cs.provider_id,
            'client_id', v_cs.client_id,
            'executed_at', v_cs.executed_at,
            'executed_late', v_executed_late,
            'auto_executed_without_checklist', true
          )
        );
      end if;

      select coalesce(nullif(trim(sr.title), ''), 'Serviço')
      into v_title
      from public.service_requests sr
      where sr.id = v_cs.service_request_id;

      v_mmd := public.mmd_ingest_event(
        'SERVICE_EXECUTED',
        v_cs.client_id,
        format('service_completion:%s:executed', v_cs.id),
        jsonb_build_object(
          'service_id', v_cs.id,
          'provider_id', v_cs.provider_id,
          'service_request_title', v_title,
          'executed_late', v_executed_late,
          'executed_late_suffix', case when v_executed_late then ' (após o prazo)' else '' end,
          'auto_executed_without_checklist', true,
          'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
        ),
        jsonb_build_object(
          'source', 'service_completion_auto_mark_executed',
          'recipient', 'client'
        )
      );

      v_marked := v_marked || jsonb_build_array(
        jsonb_build_object(
          'contracted_service_id', v_cs.id,
          'schedule_id', v_schedule_id,
          'client_id', v_cs.client_id,
          'provider_id', v_cs.provider_id,
          'executed_at', v_cs.executed_at,
          'executed_late', v_executed_late,
          'auto_executed_without_checklist', true,
          'evidence_id', v_evidence.id,
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
          'service_completion_auto_mark_executed row failed cs_id=% sqlstate=% message=%',
          v_row.id,
          sqlstate,
          sqlerrm;
    end;
  end loop;

  return jsonb_build_object(
    'scanned_limit', v_batch_size,
    'marked_count', jsonb_array_length(v_marked),
    'marked', v_marked,
    'errors_count', v_errors,
    'error_samples', v_error_samples,
    'grace_hours', v_grace_hours
  );
end;
$$;

comment on function public.service_completion_auto_mark_executed(int) is
  'service_role batch: CONFIRMED past schedule-end + auto_mark_executed_grace_hours → EXECUTED with empty frozen checklist (auto_executed_without_checklist).';

revoke all on function public.service_completion_auto_mark_executed(int)
  from public, anon, authenticated;
grant execute on function public.service_completion_auto_mark_executed(int)
  to service_role, postgres;

-- ---------------------------------------------------------------------------
-- Cron wrapper + schedule
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_cron_auto_mark_executed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_name constant text := 'service_completion_cron_auto_mark_executed';
  v_job_run_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_result jsonb;
  v_marked_count int := 0;
  v_error_count int := 0;
begin
  v_job_run_id := public.job_run_begin(v_job_name, 'v1');

  begin
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_result := public.service_completion_auto_mark_executed(null);
    v_marked_count := coalesce((v_result->>'marked_count')::int, 0);
    v_error_count := coalesce((v_result->>'errors_count')::int, 0);

    perform public.job_run_finish(
      v_job_run_id,
      v_started_at,
      v_marked_count + v_error_count,
      v_marked_count,
      v_error_count,
      jsonb_build_object(
        'auto_executed_without_checklist', true,
        'marked_count', v_marked_count,
        'errors_count', v_error_count,
        'grace_hours', v_result->'grace_hours',
        'error_samples', coalesce(v_result->'error_samples', '[]'::jsonb),
        'marked', coalesce(v_result->'marked', '[]'::jsonb)
      ),
      case when v_error_count > 0 then 'row_errors' else null end
    );

    return v_result || jsonb_build_object('job_run_id', v_job_run_id);
  exception
    when others then
      perform public.job_run_abort_latest(v_job_name, sqlerrm);
      raise;
  end;
end;
$$;

comment on function public.service_completion_cron_auto_mark_executed() is
  'pg_cron entrypoint: service_completion_auto_mark_executed with job_runs telemetry.';

revoke all on function public.service_completion_cron_auto_mark_executed()
  from public, anon, authenticated;
grant execute on function public.service_completion_cron_auto_mark_executed()
  to postgres;

do $register$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'service_completion_auto_mark_executed';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  -- Offset from auto-complete (:45) — run at :15 of same hours.
  perform cron.schedule(
    'service_completion_auto_mark_executed',
    '15 9,15,21,3 * * *',
    $$select public.service_completion_cron_auto_mark_executed();$$
  );
end;
$register$;
