-- Service dispute MVP Phase 1: open/resolve RPCs, gates, list_phase, MMD catalog.
-- Depends on 20260810170000 (IN_DISPUTE enum + audit columns already committed).

-- ---------------------------------------------------------------------------
-- MMD templates: service dispute opened (provider) / resolved (client+provider)
-- ---------------------------------------------------------------------------

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
    'service.service_dispute_opened',
    'push',
    'Disputa aberta — {{service_request_title}}',
    'O cliente abriu uma disputa de serviço. Nossa equipe irá analisar o caso.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"provider_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"},"dispute_reason":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_dispute_opened',
    'email',
    'Disputa aberta — {{service_request_title}}',
    '<p>O cliente abriu uma <strong>disputa de serviço</strong> para <strong>{{service_request_title}}</strong>.</p><p>O chat permanece aberto. A plataforma irá analisar o caso e você será notificado quando houver resolução.</p>',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"provider_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"},"dispute_reason":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_dispute_resolved',
    'push',
    'Disputa resolvida — {{service_request_title}}',
    'A disputa de serviço foi resolvida e o serviço foi concluído pela plataforma. Você ainda pode avaliar se quiser.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"provider_id":{"type":"string"},"completed_by":{"type":"string"},"optional_rating_cta":{"type":"boolean"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_dispute_resolved',
    'email',
    'Disputa resolvida — {{service_request_title}}',
    '<p>A <strong>disputa de serviço</strong> de <strong>{{service_request_title}}</strong> foi resolvida e o serviço foi concluído pela plataforma.</p><p>Você ainda pode avaliar o prestador se quiser.</p>',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"provider_id":{"type":"string"},"completed_by":{"type":"string"},"optional_rating_cta":{"type":"boolean"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- list_phase: exclusive "dispute" when CS is IN_DISPUTE
-- ---------------------------------------------------------------------------

create or replace function public.derive_service_list_phase(
  p_sr_status public.service_request_status,
  p_cs_status public.contracted_service_status,
  p_viewer_role text,
  p_viewer_id uuid,
  p_cs_provider_id uuid
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_sr_status = 'CANCELLED'::public.service_request_status then 'cancelled'
    when p_sr_status = 'COMPLETED'::public.service_request_status
      and p_cs_status = 'CANCELLED'::public.contracted_service_status then 'cancelled'
    when p_cs_status = 'IN_DISPUTE'::public.contracted_service_status then 'dispute'
    when p_viewer_role = 'provider' then
      case
        when p_cs_provider_id = p_viewer_id
          and p_cs_status = 'COMPLETED'::public.contracted_service_status then 'completed'
        when p_cs_provider_id = p_viewer_id
          and p_cs_status is not null
          and p_cs_status <> 'CANCELLED'::public.contracted_service_status then 'in_progress'
        when p_sr_status = 'OPEN'::public.service_request_status then 'negotiation'
        else 'cancelled'
      end
    else
      case
        when p_sr_status = 'COMPLETED'::public.service_request_status
          and p_cs_status = 'COMPLETED'::public.contracted_service_status then 'completed'
        when p_sr_status = 'COMPLETED'::public.service_request_status then 'in_progress'
        else 'negotiation'
      end
  end;
$$;

comment on function public.derive_service_list_phase(
  public.service_request_status,
  public.contracted_service_status,
  text,
  uuid,
  uuid
) is
  'Maps SR/CS status to list tab phase (negotiation/in_progress/completed/cancelled/dispute).';

-- ---------------------------------------------------------------------------
-- Hard gate: never transition IN_DISPUTE → CANCELLED (self-serve or batch)
-- ---------------------------------------------------------------------------

create or replace function public.trg_contracted_services_block_cancel_in_dispute()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'IN_DISPUTE'::public.contracted_service_status
    and new.status = 'CANCELLED'::public.contracted_service_status
  then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contracted_services_block_cancel_in_dispute
  on public.contracted_services;

create trigger trg_contracted_services_block_cancel_in_dispute
  before update of status on public.contracted_services
  for each row
  execute function public.trg_contracted_services_block_cancel_in_dispute();

comment on function public.trg_contracted_services_block_cancel_in_dispute() is
  'Blocks CANCELLED transitions while contracted_services.status = IN_DISPUTE.';

-- ---------------------------------------------------------------------------
-- RPC: client opens service dispute (EXECUTED → IN_DISPUTE)
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_open_dispute(
  p_contracted_service_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_client_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_disputed_at timestamptz := now();
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 2000)), '');
  v_title text;
  v_chat_id uuid;
  v_system_text text;
  v_mmd jsonb;
  v_schedule_id uuid;
begin
  if v_client_id is null then
    raise exception 'Authentication required for service_completion_open_dispute'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.client_id = v_client_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  if v_cs.status = 'IN_DISPUTE'::public.contracted_service_status then
    raise exception 'DISPUTE_OPEN'
      using errcode = 'P0001';
  end if;

  if v_cs.status is distinct from 'EXECUTED'::public.contracted_service_status then
    raise exception 'DISPUTE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  update public.contracted_services cs
  set
    status = 'IN_DISPUTE'::public.contracted_service_status,
    disputed_at = v_disputed_at,
    disputed_by = v_client_id,
    dispute_reason = v_reason
  where cs.id = p_contracted_service_id
    and cs.status = 'EXECUTED'::public.contracted_service_status
  returning * into v_cs;

  if not found then
    -- Lost race to auto-complete / concurrent confirm
    raise exception 'DISPUTE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_chat_id := public.resolve_proposal_chat_id(
    v_cs.service_request_id,
    v_cs.provider_id
  );

  if v_chat_id is not null then
    v_system_text := 'O cliente abriu uma disputa de serviço. O chat permanece aberto enquanto a plataforma analisa o caso.';
    if v_reason is not null then
      v_system_text := v_system_text || E'\n\nMotivo informado: ' || v_reason;
    end if;

    insert into public.chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      payload,
      linked_entity_type,
      linked_entity_id,
      idempotency_key
    )
    values (
      v_chat_id,
      null,
      'SYSTEM'::public.cns_message_type,
      jsonb_build_object('text', v_system_text),
      'service_request',
      v_cs.service_request_id,
      gen_random_uuid()
    );
  end if;

  select ps.id
  into v_schedule_id
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
  order by ps.created_at desc
  limit 1;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_DISPUTE_OPENED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'EXECUTED',
      p_to_state := 'IN_DISPUTE',
      p_actor := 'client'::public.payment_audit_actor,
      p_actor_id := v_client_id,
      p_metadata := jsonb_build_object(
        'disputed_at', v_disputed_at,
        'dispute_reason', v_reason,
        'source', 'service_completion_open_dispute'
      )
    );
  end if;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_DISPUTE_OPENED',
    v_cs.provider_id,
    format('service_completion:%s:dispute_opened', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'service_request_title', v_title,
      'dispute_reason', v_reason,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_open_dispute',
      'recipient', 'provider'
    )
  );

  raise log
    'service_completion_open_dispute cs_id=% client_id=%',
    p_contracted_service_id,
    v_client_id;

  return jsonb_build_object(
    'ok', true,
    'contracted_service_id', p_contracted_service_id,
    'status', 'IN_DISPUTE',
    'disputed_at', v_disputed_at,
    'disputed_by', v_client_id,
    'dispute_reason', v_reason,
    'chat_id', v_chat_id,
    'provider_id', v_cs.provider_id,
    'mmd', v_mmd
  );
end;
$$;

comment on function public.service_completion_open_dispute(uuid, text) is
  'Client opens a service dispute: EXECUTED → IN_DISPUTE (CAS), SYSTEM chat message, MMD to provider. Does not close the chat.';

revoke all on function public.service_completion_open_dispute(uuid, text)
  from public, anon, service_role;
grant execute on function public.service_completion_open_dispute(uuid, text)
  to authenticated;
grant execute on function public.service_completion_open_dispute(uuid, text)
  to postgres;

-- ---------------------------------------------------------------------------
-- RPC: admin / service_role resolves dispute (IN_DISPUTE → COMPLETED)
-- ---------------------------------------------------------------------------

create or replace function public.service_completion_admin_resolve_dispute(
  p_contracted_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_service_role boolean := (coalesce(auth.role(), '') = 'service_role');
  v_is_admin boolean := coalesce(public.is_platform_admin(), false);
  v_cs public.contracted_services%rowtype;
  v_completed_at timestamptz := now();
  v_title text;
  v_chat_id uuid;
  v_system_text text;
  v_mmd_client jsonb;
  v_mmd_provider jsonb;
  v_schedule_id uuid;
begin
  if not v_is_service_role and not v_is_admin then
    raise exception 'Admin or service_role required for service_completion_admin_resolve_dispute'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- Idempotent: already resolved by admin
  if v_cs.status = 'COMPLETED'::public.contracted_service_status
    and v_cs.completed_by = 'admin'
    and v_cs.dispute_resolved_at is not null
  then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'contracted_service_id', p_contracted_service_id,
      'status', 'COMPLETED',
      'completed_at', v_cs.completed_at,
      'completed_by', 'admin',
      'dispute_resolved_at', v_cs.dispute_resolved_at
    );
  end if;

  if v_cs.status is distinct from 'IN_DISPUTE'::public.contracted_service_status then
    raise exception 'DISPUTE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  update public.contracted_services cs
  set
    status = 'COMPLETED'::public.contracted_service_status,
    completed_at = v_completed_at,
    completed_by = 'admin',
    dispute_resolved_at = v_completed_at
  where cs.id = p_contracted_service_id
    and cs.status = 'IN_DISPUTE'::public.contracted_service_status
  returning * into v_cs;

  if not found then
    raise exception 'DISPUTE_NOT_ALLOWED'
      using errcode = 'P0001';
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_chat_id := public.resolve_proposal_chat_id(
    v_cs.service_request_id,
    v_cs.provider_id
  );

  if v_chat_id is not null then
    v_system_text :=
      'A disputa de serviço foi resolvida pela plataforma. O serviço foi concluído. '
      || 'O cliente ainda pode enviar uma avaliação se quiser.';

    insert into public.chat_messages (
      chat_id,
      sender_user_id,
      message_type,
      payload,
      linked_entity_type,
      linked_entity_id,
      idempotency_key
    )
    values (
      v_chat_id,
      null,
      'SYSTEM'::public.cns_message_type,
      jsonb_build_object('text', v_system_text),
      'service_request',
      v_cs.service_request_id,
      gen_random_uuid()
    );
  end if;

  select ps.id
  into v_schedule_id
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
  order by ps.created_at desc
  limit 1;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_DISPUTE_RESOLVED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'IN_DISPUTE',
      p_to_state := 'COMPLETED',
      p_actor := 'support'::public.payment_audit_actor,
      p_actor_id := v_actor_id,
      p_metadata := jsonb_build_object(
        'completed_by', 'admin',
        'dispute_resolved_at', v_completed_at,
        'source', 'service_completion_admin_resolve_dispute',
        'via_service_role', v_is_service_role
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceCompleted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_payload := jsonb_build_object(
        'completed_by', 'admin',
        'client_id', v_cs.client_id,
        'provider_id', v_cs.provider_id,
        'dispute_resolved', true
      )
    );
  end if;

  v_mmd_client := public.mmd_ingest_event(
    'SERVICE_DISPUTE_RESOLVED',
    v_cs.client_id,
    format('service_completion:%s:dispute_resolved:client', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'completed_by', 'admin',
      'optional_rating_cta', true,
      'service_request_title', v_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_admin_resolve_dispute',
      'recipient', 'client'
    )
  );

  v_mmd_provider := public.mmd_ingest_event(
    'SERVICE_DISPUTE_RESOLVED',
    v_cs.provider_id,
    format('service_completion:%s:dispute_resolved:provider', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'completed_by', 'admin',
      'optional_rating_cta', false,
      'service_request_title', v_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_admin_resolve_dispute',
      'recipient', 'provider'
    )
  );

  raise log
    'service_completion_admin_resolve_dispute cs_id=% actor=% service_role=%',
    p_contracted_service_id,
    v_actor_id,
    v_is_service_role;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'contracted_service_id', p_contracted_service_id,
    'status', 'COMPLETED',
    'completed_at', v_completed_at,
    'completed_by', 'admin',
    'dispute_resolved_at', v_completed_at,
    'chat_id', v_chat_id,
    'mmd_client', v_mmd_client,
    'mmd_provider', v_mmd_provider
  );
end;
$$;

comment on function public.service_completion_admin_resolve_dispute(uuid) is
  'Admin/service_role resolves service dispute: IN_DISPUTE → COMPLETED (completed_by=admin), SYSTEM chat, MMD to client+provider. No rating in the same TX.';

revoke all on function public.service_completion_admin_resolve_dispute(uuid)
  from public, anon;
grant execute on function public.service_completion_admin_resolve_dispute(uuid)
  to authenticated;
grant execute on function public.service_completion_admin_resolve_dispute(uuid)
  to service_role;
grant execute on function public.service_completion_admin_resolve_dispute(uuid)
  to postgres;

-- Patched: mmd_ingest_event.sql
CREATE OR REPLACE FUNCTION public.mmd_ingest_event(p_event_type text, p_recipient_profile_id uuid, p_idempotency_key text, p_template_variables jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'message_dispatcher'
AS $function$
declare
  v_started_at timestamptz := clock_timestamp();
  v_template_key text;
  v_channels message_dispatcher.message_channel[];
  v_push_bypass_limits boolean;
  v_email_bypass_limits boolean;
  v_channel_bypass_limits boolean;
  v_channel message_dispatcher.message_channel;
  v_channel_suffix text;
  v_channel_idempotency text;
  v_ingest_key uuid;
  v_variables jsonb;
  v_dispatch jsonb;
  v_dispatches jsonb := '[]'::jsonb;
  v_skipped_count int := 0;
  v_ingested_count int := 0;
  v_audience text := lower(coalesce(p_metadata->>'recipient', 'client'));
  v_cancellation_reason text := upper(btrim(coalesce(p_metadata->>'cancellation_reason', '')));
begin
  if nullif(btrim(p_event_type), '') is null then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if p_recipient_profile_id is null then
    raise exception 'p_recipient_profile_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_template_variables is null then
    raise exception 'p_template_variables must not be null'
      using errcode = '22023';
  end if;

  case upper(btrim(p_event_type))
    when 'CHAT_MESSAGE_SENT' then
      v_template_key := 'chat.new_message';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_SUBMITTED' then
      v_template_key := 'proposal.submitted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_REVISION_REQUESTED' then
      v_template_key := 'proposal.revision_requested';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_ACCEPTED' then
      v_template_key := 'proposal.accepted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_REJECTED' then
      v_template_key := 'proposal.rejected';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_EXPIRED' then
      v_template_key := 'proposal.expired';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROPOSAL_EXPIRING_SOON' then
      v_template_key := 'proposal.expiring_soon';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'CONVERSATION_CLOSED' then
      v_template_key := 'chat.closed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'UPCOMING_CHARGE' then
      v_template_key := 'payment.upcoming_charge';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'CHARGE_SUCCEEDED' then
      if v_audience = 'provider' then
        v_template_key := 'payment.charge_succeeded_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.charge_succeeded';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'CHARGE_FAILED' then
      v_template_key := 'payment.charge_failed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'CHARGE_FAILED_PERMANENT' then
      if v_audience = 'provider' then
        v_template_key := 'payment.charge_failed_permanent_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.charge_failed_permanent';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'CHARGE_IN_ANALYSIS' then
      v_template_key := 'payment.charge_in_analysis';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_AUTO_CANCELLED' then
      if v_cancellation_reason = 'PROVIDER_SUSPENDED' then
        if v_audience = 'provider' then
          v_template_key := 'payment.service_auto_cancelled_suspended_provider';
          v_channels := array['push']::message_dispatcher.message_channel[];
          v_push_bypass_limits := true;
          v_email_bypass_limits := false;
        else
          v_template_key := 'payment.service_auto_cancelled_suspended';
          v_channels := array['push', 'email']::message_dispatcher.message_channel[];
          v_push_bypass_limits := true;
          v_email_bypass_limits := true;
        end if;
      elsif v_audience = 'provider' then
        v_template_key := 'payment.service_auto_cancelled_provider';
        v_channels := array['push']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.service_auto_cancelled';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := true;
      end if;
    when 'PROVIDER_KYC_SUBMITTED' then
      v_template_key := 'account.provider_kyc_submitted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'PROVIDER_ONBOARDING_UNDER_REVIEW' then
      v_template_key := 'account.provider_kyc_under_review';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_KYC_REJECTED' then
      v_template_key := 'account.provider_kyc_rejected';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_ACTIVATED' then
      v_template_key := 'account.provider_activated';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_ONBOARDING_INCOMPLETE_REMINDER' then
      v_template_key := 'account.provider_onboarding_incomplete_reminder';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'TRANSACTION_DISPUTE' then
      v_template_key := 'payment.transaction_dispute';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
      v_email_bypass_limits := false;
    when 'SERVICE_EXECUTED' then
      v_template_key := 'service.service_executed';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_COMPLETED' then
      v_template_key := 'service.service_completed';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_AUTO_COMPLETED' then
      v_template_key := 'service.service_auto_completed';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_DISPUTE_OPENED' then
      v_template_key := 'service.service_dispute_opened';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_DISPUTE_RESOLVED' then
      v_template_key := 'service.service_dispute_resolved';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;

    when 'SERVICE_RESCHEDULE_REQUESTED' then
      v_template_key := 'service.reschedule_requested';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_RESCHEDULE_PROPOSED' then
      v_template_key := 'service.reschedule_proposed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_RESCHEDULE_ADJUSTMENT_REQUESTED' then
      v_template_key := 'service.reschedule_adjustment_requested';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_RESCHEDULE_CANCELLED' then
      v_template_key := 'service.reschedule_cancelled';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_RESCHEDULE_ACCEPTED' then
      if v_audience = 'provider' then
        v_template_key := 'service.reschedule_accepted_provider';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      else
        v_template_key := 'service.reschedule_accepted';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      end if;
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'SERVICE_RESCHEDULE_REMINDER' then
      v_template_key := 'service.reschedule_reminder';
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
    when 'PROVIDER_SUSPENDED' then
      if v_audience = 'provider' then
        v_template_key := 'account.provider_suspended';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      else
        v_template_key := 'payment.provider_suspended_client';
        v_channels := array['push', 'email']::message_dispatcher.message_channel[];
        v_push_bypass_limits := true;
        v_email_bypass_limits := false;
      end if;
    else
      raise log 'NOTIFICATION_SKIPPED event_type=% recipient=% reason=unsupported_event_type',
        p_event_type,
        p_recipient_profile_id;

      return jsonb_build_object(
        'event_type', p_event_type,
        'skipped', true,
        'reason', 'unsupported_event_type',
        'dispatches', '[]'::jsonb
      );
  end case;

  v_variables := p_template_variables;

  foreach v_channel in array v_channels loop
    v_channel_suffix := ':' || v_channel::text;

    if right(p_idempotency_key, char_length(v_channel_suffix)) = v_channel_suffix then
      v_channel_idempotency := p_idempotency_key;
    else
      v_channel_idempotency := p_idempotency_key || v_channel_suffix;
    end if;

    v_ingest_key := public.mmd_idempotency_uuid(v_channel_idempotency);

    v_channel_bypass_limits := case v_channel
      when 'push'::message_dispatcher.message_channel then v_push_bypass_limits
      when 'email'::message_dispatcher.message_channel then v_email_bypass_limits
      else false
    end;

    begin
      v_dispatch := message_dispatcher.message_dispatcher_ingest(
        v_ingest_key,
        p_recipient_profile_id,
        v_channel,
        v_template_key,
        v_variables,
        now(),
        'cns',
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'event_type', upper(btrim(p_event_type)),
          'idempotency_key', v_channel_idempotency
        ),
        v_channel_bypass_limits
      );

      v_ingested_count := v_ingested_count + 1;
      v_dispatches := v_dispatches || jsonb_build_array(
        v_dispatch || jsonb_build_object(
          'channel', v_channel,
          'bypass_limits', v_channel_bypass_limits
        )
      );
    exception
      when others then
        v_skipped_count := v_skipped_count + 1;
        raise log 'NOTIFICATION_SKIPPED event_type=% channel=% recipient=% idempotency_key=% sqlstate=% message=%',
          p_event_type,
          v_channel,
          p_recipient_profile_id,
          v_channel_idempotency,
          sqlstate,
          sqlerrm;

        v_dispatches := v_dispatches || jsonb_build_array(
          jsonb_build_object(
            'skipped', true,
            'channel', v_channel,
            'reason', sqlerrm
          )
        );
    end;
  end loop;

  raise log 'mmd_ingest_event_duration_ms=% event_type=% ingested=% skipped=%',
    round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint,
    p_event_type,
    v_ingested_count,
    v_skipped_count;

  return jsonb_build_object(
    'event_type', upper(btrim(p_event_type)),
    'template_key', v_template_key,
    'bypass_limits', jsonb_build_object(
      'push', v_push_bypass_limits,
      'email', v_email_bypass_limits
    ),
    'ingested_count', v_ingested_count,
    'skipped_count', v_skipped_count,
    'dispatches', v_dispatches
  );
end;
$function$;

-- Patched: get_service_completion_context.sql
CREATE OR REPLACE FUNCTION public.get_service_completion_context(p_service_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_sr public.service_requests%rowtype;
  v_enrichment public.service_request_enrichments%rowtype;
  v_cs public.contracted_services%rowtype;
  v_evidence public.contracted_service_completion_evidence%rowtype;
  v_has_enrichment boolean := false;
  v_has_cs boolean := false;
  v_has_evidence boolean := false;
  v_is_client_owner boolean := false;
  v_is_contracted_provider boolean := false;
  v_is_platform_admin boolean := false;
  v_is_full_detail boolean := false;
  v_enrichment_ready boolean := false;
  v_include_schema boolean := false;
  v_include_responses boolean := false;
  v_responses jsonb := null;
  v_phase text := 'absent';
  v_has_rating boolean := false;
  v_enrichment_json jsonb;
  v_cs_json jsonb;
  v_evidence_json jsonb;
  v_capabilities jsonb;
begin
  if v_viewer_id is null then
    raise exception 'Authentication required for get_service_completion_context'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  v_is_platform_admin := coalesce(public.is_platform_admin(), false);

  -- Entry: marketplace viewer access OR platform admin (admin may lack feed visibility).
  if not v_is_platform_admin
    and not public.service_viewer_has_access(p_service_request_id, v_viewer_id)
  then
    raise exception 'Service not found or access denied'
      using errcode = '42501';
  end if;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id;

  if not found then
    raise exception 'Service not found'
      using errcode = 'P0002';
  end if;

  v_is_client_owner := (v_sr.client_id = v_viewer_id);

  select e.*
  into v_enrichment
  from public.service_request_enrichments e
  where e.service_request_id = p_service_request_id;
  v_has_enrichment := found;

  if v_has_enrichment then
    v_enrichment_ready := (v_enrichment.status = 'READY'::public.enrichment_status);
  end if;

  if v_sr.contracted_service_id is not null then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.id = v_sr.contracted_service_id;
    v_has_cs := found;
  end if;

  if not v_has_cs then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.service_request_id = p_service_request_id
    order by cs.created_at desc
    limit 1;
    v_has_cs := found;
  end if;

  if v_has_cs then
    v_is_contracted_provider := (v_cs.provider_id = v_viewer_id);

    select ev.*
    into v_evidence
    from public.contracted_service_completion_evidence ev
    where ev.contracted_service_id = v_cs.id;
    v_has_evidence := found;

    v_has_rating := exists (
      select 1
      from public.service_ratings r
      where r.contracted_service_id = v_cs.id
    );
  end if;

  -- Full detail: SR client, CS provider, or platform admin — not raw marketplace viewers.
  v_is_full_detail := (
    v_is_client_owner
    or v_is_contracted_provider
    or v_is_platform_admin
  );

  v_include_schema := v_enrichment_ready and v_is_full_detail;

  if v_has_evidence then
    v_phase := v_evidence.phase::text;

    if v_evidence.phase = 'frozen'::public.completion_evidence_phase
      and (v_is_client_owner or v_is_contracted_provider or v_is_platform_admin)
    then
      v_include_responses := true;
      v_responses := v_evidence.responses;
    elsif v_evidence.phase = 'draft'::public.completion_evidence_phase
      and (v_is_contracted_provider or v_is_platform_admin)
    then
      -- Provider draft only — never expose draft responses to clients
      v_include_responses := true;
      v_responses := v_evidence.responses;
    end if;
  end if;

  if v_has_enrichment then
    if v_is_full_detail then
      v_enrichment_json := jsonb_build_object(
        'status', v_enrichment.status,
        'source', v_enrichment.source,
        'materialized_at', v_enrichment.materialized_at,
        'ops_attention', (v_enrichment.ops_attention_at is not null),
        'schema_version', v_enrichment.schema_version
      );
      if v_include_schema then
        v_enrichment_json := v_enrichment_json
          || jsonb_build_object('checklist_schema', v_enrichment.checklist_schema);
      end if;
    else
      -- Marketplace-only: status flags + ready boolean; no schema / ops internals.
      v_enrichment_json := jsonb_build_object(
        'status', v_enrichment.status,
        'ready', v_enrichment_ready
      );
    end if;
  else
    v_enrichment_json := null;
  end if;

  if v_has_cs then
    if v_is_full_detail then
      v_cs_json := jsonb_build_object(
        'id', v_cs.id,
        'status', v_cs.status,
        'executed_at', v_cs.executed_at,
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by,
        'provider_id', v_cs.provider_id,
        'client_id', v_cs.client_id,
        'disputed_at', v_cs.disputed_at,
        'disputed_by', v_cs.disputed_by,
        'dispute_reason', v_cs.dispute_reason,
        'dispute_resolved_at', v_cs.dispute_resolved_at
      );
    else
      -- No counterparty user ids for non-participants.
      v_cs_json := jsonb_build_object(
        'id', v_cs.id,
        'status', v_cs.status,
        'executed_at', v_cs.executed_at,
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by,
        'disputed_at', v_cs.disputed_at,
        'dispute_resolved_at', v_cs.dispute_resolved_at
      );
    end if;
  else
    v_cs_json := jsonb_build_object(
      'id', null,
      'status', null,
      'executed_at', null,
      'completed_at', null,
      'completed_by', null
    );
  end if;

  if v_is_full_detail then
    v_evidence_json := jsonb_build_object(
      'phase', v_phase,
      'frozen_at', case when v_has_evidence then v_evidence.frozen_at else null end,
      'auto_executed_without_checklist',
        case
          when v_has_evidence then v_evidence.auto_executed_without_checklist
          else false
        end,
      'draft_version', case
        when v_has_evidence and (v_is_contracted_provider or v_is_platform_admin)
        then v_evidence.draft_version
        else null
      end
    );

    if v_include_responses then
      v_evidence_json := v_evidence_json || jsonb_build_object('responses', v_responses);
    end if;
  else
    -- Marketplace-only: phase flag without evidence body.
    v_evidence_json := jsonb_build_object(
      'phase', v_phase,
      'frozen_at', null,
      'auto_executed_without_checklist', null,
      'draft_version', null
    );
  end if;

  v_capabilities := jsonb_build_object(
    'can_mark_executed',
      v_is_contracted_provider
      and v_has_cs
      and v_cs.status = 'CONFIRMED'::public.contracted_service_status
      and v_enrichment_ready,
    'can_save_draft',
      v_is_contracted_provider
      and v_has_cs
      and v_cs.status = 'CONFIRMED'::public.contracted_service_status
      and v_enrichment_ready
      and (
        not v_has_evidence
        or v_evidence.phase = 'draft'::public.completion_evidence_phase
      ),
    'can_confirm_with_rating',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'EXECUTED'::public.contracted_service_status,
    'can_submit_optional_rating',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'COMPLETED'::public.contracted_service_status
      and v_cs.completed_by in ('system', 'admin')
      and not v_has_rating,
    'show_dispute_stub',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'EXECUTED'::public.contracted_service_status,
    'can_open_dispute',
      v_is_client_owner
      and v_has_cs
      and v_cs.status = 'EXECUTED'::public.contracted_service_status,
    'is_in_dispute',
      v_has_cs
      and v_cs.status = 'IN_DISPUTE'::public.contracted_service_status
  );

  raise log
    'get_service_completion_context sr_id=% viewer=% client_owner=% contracted_provider=% full_detail=% enrichment_ready=%',
    p_service_request_id,
    v_viewer_id,
    v_is_client_owner,
    v_is_contracted_provider,
    v_is_full_detail,
    v_enrichment_ready;

  return jsonb_build_object(
    'service_request_id', p_service_request_id,
    'enrichment', v_enrichment_json,
    'contracted_service', v_cs_json,
    'evidence', v_evidence_json,
    'capabilities', v_capabilities
  );
end;
$function$;

-- Patched: service_completion_confirm_with_rating.sql
CREATE OR REPLACE FUNCTION public.service_completion_confirm_with_rating(p_contracted_service_id uuid, p_score_quality smallint, p_score_punctuality smallint, p_score_communication smallint, p_score_value smallint, p_comment text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'message_dispatcher'
AS $function$
declare
  v_client_id uuid := auth.uid();
  v_cs public.contracted_services%rowtype;
  v_schedule_id uuid;
  v_is_disputed boolean;
  v_mmd jsonb;
  v_completed_at timestamptz := now();
  v_title text;
  v_rating_id uuid;
  v_overall numeric(4, 2);
  v_w_quality numeric;
  v_w_punctuality numeric;
  v_w_communication numeric;
  v_w_value numeric;
  v_idem text := nullif(btrim(p_idempotency_key), '');
  v_existing_rating_id uuid;
begin
  if v_client_id is null then
    raise exception 'Authentication required for service_completion_confirm_with_rating'
      using errcode = '42501';
  end if;

  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  if p_score_quality is null
    or p_score_punctuality is null
    or p_score_communication is null
    or p_score_value is null
  then
    raise exception 'MISSING_RATING_SCORES'
      using errcode = '22023';
  end if;

  if p_score_quality not between 1 and 5
    or p_score_punctuality not between 1 and 5
    or p_score_communication not between 1 and 5
    or p_score_value not between 1 and 5
  then
    raise exception 'RATING_SCORES_OUT_OF_RANGE'
      using errcode = '22023';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
    and cs.client_id = v_client_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND_OR_UNAUTHORIZED'
      using errcode = 'P0003';
  end if;

  -- Idempotent: already COMPLETED by client with rating
  if v_cs.status = 'COMPLETED'::public.contracted_service_status then
    select sr.id
    into v_existing_rating_id
    from public.service_ratings sr
    where sr.contracted_service_id = p_contracted_service_id;

    if v_existing_rating_id is not null
      and v_cs.completed_by = 'client'
    then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'contracted_service_id', p_contracted_service_id,
        'status', 'COMPLETED',
        'completed_at', v_cs.completed_at,
        'completed_by', v_cs.completed_by,
        'rating_id', v_existing_rating_id
      );
    end if;

    raise exception 'ALREADY_COMPLETED'
      using errcode = 'P0001';
  end if;

  if v_cs.status = 'IN_DISPUTE'::public.contracted_service_status then
    raise exception 'DISPUTE_OPEN'
      using errcode = 'P0001';
  end if;

  if v_cs.status is distinct from 'EXECUTED'::public.contracted_service_status then
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  -- EXECUTED must have frozen evidence before client can COMPLETE
  if not exists (
    select 1
    from public.contracted_service_completion_evidence ev
    where ev.contracted_service_id = p_contracted_service_id
      and ev.phase = 'frozen'::public.completion_evidence_phase
  ) then
    raise exception 'FROZEN_EVIDENCE_REQUIRED'
      using errcode = 'P0001';
  end if;

  -- Manual confirm requires a prior execution declaration (checkbox audit row).
  -- Auto-complete does not use this RPC and does not require a declaration.
  if not exists (
    select 1
    from public.service_completion_execution_declarations d
    where d.contracted_service_id = p_contracted_service_id
      and d.client_id = v_client_id
  ) then
    raise exception 'EXECUTION_DECLARATION_REQUIRED'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.service_ratings sr
    where sr.contracted_service_id = p_contracted_service_id
  ) then
    raise exception 'RATING_ALREADY_EXISTS'
      using errcode = '23505';
  end if;

  v_w_quality := public.platform_constant_numeric('matching.rating_dimension_weight_quality', 0.40);
  v_w_punctuality := public.platform_constant_numeric('matching.rating_dimension_weight_punctuality', 0.25);
  v_w_communication := public.platform_constant_numeric('matching.rating_dimension_weight_communication', 0.20);
  v_w_value := public.platform_constant_numeric('matching.rating_dimension_weight_value', 0.15);

  v_overall := round((
    v_w_quality * p_score_quality
    + v_w_punctuality * p_score_punctuality
    + v_w_communication * p_score_communication
    + v_w_value * p_score_value
  )::numeric, 2);

  -- Insert rating first; COMPLETED only if insert succeeds (same TX).
  insert into public.service_ratings (
    contracted_service_id,
    service_request_id,
    client_id,
    provider_id,
    score_quality,
    score_punctuality,
    score_communication,
    score_value,
    overall_score,
    comment
  )
  values (
    p_contracted_service_id,
    v_cs.service_request_id,
    v_cs.client_id,
    v_cs.provider_id,
    p_score_quality,
    p_score_punctuality,
    p_score_communication,
    p_score_value,
    v_overall,
    nullif(btrim(p_comment), '')
  )
  returning id into v_rating_id;

  update public.contracted_services cs
  set
    status = 'COMPLETED'::public.contracted_service_status,
    completed_at = v_completed_at,
    completed_by = 'client'
  where cs.id = p_contracted_service_id
    and cs.status = 'EXECUTED'::public.contracted_service_status
  returning * into v_cs;

  if not found then
    -- Lost race to auto-complete (or concurrent confirm)
    raise exception 'INVALID_STATUS_TRANSITION'
      using errcode = 'P0001';
  end if;

  select ps.id, ps.is_disputed
  into v_schedule_id, v_is_disputed
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
  order by ps.created_at desc
  limit 1;

  if v_schedule_id is not null then
    perform public.payment_write_audit(
      p_event_type := 'SERVICE_COMPLETED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_schedule_id := v_schedule_id,
      p_from_state := 'EXECUTED',
      p_to_state := 'COMPLETED',
      p_actor := 'client'::public.payment_audit_actor,
      p_actor_id := v_client_id,
      p_metadata := jsonb_build_object(
        'completed_at', v_completed_at,
        'completed_by', 'client',
        'rating_id', v_rating_id,
        'overall_score', v_overall,
        'is_disputed', coalesce(v_is_disputed, false),
        'idempotency_key', v_idem,
        'source', 'service_completion_confirm_with_rating'
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ServiceCompleted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule_id,
      p_service_id := p_contracted_service_id,
      p_payload := jsonb_build_object(
        'completed_by', 'client',
        'client_id', v_cs.client_id,
        'provider_id', v_cs.provider_id,
        'rating_id', v_rating_id,
        'is_disputed', coalesce(v_is_disputed, false)
      )
    );
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_title
  from public.service_requests sr
  where sr.id = v_cs.service_request_id;

  v_mmd := public.mmd_ingest_event(
    'SERVICE_COMPLETED',
    v_cs.provider_id,
    format('service_completion:%s:completed_client', p_contracted_service_id),
    jsonb_build_object(
      'service_id', p_contracted_service_id,
      'client_id', v_cs.client_id,
      'provider_id', v_cs.provider_id,
      'completed_by', 'client',
      'rating_id', v_rating_id,
      'overall_score', v_overall,
      'service_request_title', v_title,
      'deep_link_path', format('/dashboard/services/%s', v_cs.service_request_id)
    ),
    jsonb_build_object(
      'source', 'service_completion_confirm_with_rating',
      'recipient', 'provider',
      'idempotency_key', v_idem
    )
  );

  raise log
    'service_completion_confirm_with_rating cs_id=% rating_id=%',
    p_contracted_service_id,
    v_rating_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'contracted_service_id', p_contracted_service_id,
    'status', 'COMPLETED',
    'completed_at', v_completed_at,
    'completed_by', 'client',
    'rating_id', v_rating_id,
    'overall_score', v_overall,
    'provider_id', v_cs.provider_id,
    'mmd', v_mmd
  );
end;
$function$;

-- Patched: payment_pre_charge_cancel.sql
CREATE OR REPLACE FUNCTION public.payment_pre_charge_cancel(p_service_id uuid, p_actor_id uuid, p_cancellation_reason text DEFAULT NULL::text, p_initiator text DEFAULT 'client'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_actor public.payment_audit_actor;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_pre_charge_cancel'
      using errcode = '42501';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status in (
    'COMPLETED'::public.contracted_service_status,
    'IN_DISPUTE'::public.contracted_service_status
  ) then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
    and not public.payment_schedule_state_is_terminal(ps.state)
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state then
    raise exception 'PAYMENT_IN_ANALYSIS'
      using errcode = 'P0001';
  end if;

  if v_schedule.state not in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state
  ) then
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  v_reason := coalesce(
    nullif(btrim(p_cancellation_reason), ''),
    case p_initiator
      when 'client' then 'CLIENT_INITIATED'
      else 'PROVIDER_INITIATED'
    end
  );

  v_actor := case p_initiator
    when 'client' then 'client'::public.payment_audit_actor
    else 'provider'::public.payment_audit_actor
  end;

  perform public.cns_cancel_active_service_reschedule_requests(p_service_id);

  update public.contracted_services cs
  set
    status = 'CANCELLED'::public.contracted_service_status,
    cancellation_reason = v_reason
  where cs.id = p_service_id;

  update public.payment_schedules ps
  set
    state = 'CANCELLED'::public.payment_schedule_state,
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where ps.id = v_schedule.id;

  perform public.cns_close_contracted_service_chat(
    p_contracted_service_id := p_service_id,
    p_closed_by_user_id := p_actor_id,
    p_initiator := p_initiator,
    p_cancellation_reason := v_reason,
    p_pre_charge := true
  );

  perform public.payment_write_audit(
    p_event_type := 'PRE_CHARGE_CANCELLED',
    p_entity_type := 'payment_schedule',
    p_entity_id := v_schedule.id,
    p_service_id := p_service_id,
    p_schedule_id := v_schedule.id,
    p_from_state := v_schedule.state::text,
    p_to_state := 'CANCELLED',
    p_actor := v_actor,
    p_actor_id := p_actor_id,
    p_metadata := jsonb_build_object(
      'cancellation_reason', v_reason,
      'initiator', p_initiator
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ServiceAutoCancelled',
    p_aggregate_type := 'payment_schedule',
    p_aggregate_id := v_schedule.id,
    p_service_id := p_service_id,
    p_payload := jsonb_build_object(
      'schedule_id', v_schedule.id,
      'cancellation_reason', v_reason,
      'pre_charge', true
    )
  );

  return v_schedule.id;
end;
$function$;

-- Patched: payment_prepare_refund_request.sql
CREATE OR REPLACE FUNCTION public.payment_prepare_refund_request(p_service_id uuid, p_actor_id uuid, p_cancellation_reason text DEFAULT NULL::text, p_initiator text DEFAULT 'client'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_exec_at timestamptz;
  v_charge_amount numeric(12, 2);
  v_refund jsonb;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_prepare_refund_request'
      using errcode = '42501';
  end if;

  if p_service_id is null or p_actor_id is null then
    raise exception 'p_service_id and p_actor_id are required'
      using errcode = '22023';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status in (
    'COMPLETED'::public.contracted_service_status,
    'IN_DISPUTE'::public.contracted_service_status
  ) then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
    and ps.state = 'PAID'::public.payment_schedule_state
  for update;

  if not found then
    if exists (
      select 1
      from public.payment_schedules ps
      where ps.contracted_service_id = p_service_id
        and ps.state = 'IN_ANALYSIS'::public.payment_schedule_state
    ) then
      raise exception 'PAYMENT_IN_ANALYSIS'
        using errcode = 'P0001';
    end if;

    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  if v_schedule.gateway_transaction_id is null then
    raise exception 'TRANSACTION_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  v_exec_at := public.payment_service_execution_at(v_service);

  v_charge_amount := coalesce(
    v_schedule.paid_amount,
    public.payment_calculate_charge_amount(
      v_schedule.client_card_token_id,
      v_schedule.base_amount,
      v_schedule.installment_number
    )
  );

  v_refund := public.payment_calculate_refund_amount(
    v_charge_amount,
    v_schedule.base_amount,
    v_exec_at,
    p_initiator
  );

  v_refund_amount := (v_refund->>'refund_amount')::numeric(12, 2);
  v_penalty_tier := v_refund->>'penalty_tier';

  return jsonb_build_object(
    'schedule_id', v_schedule.id,
    'gateway_transaction_id', v_schedule.gateway_transaction_id,
    'paid_amount', v_schedule.paid_amount,
    'base_amount', v_schedule.base_amount,
    'charge_amount', v_charge_amount,
    'refund_amount', v_refund_amount,
    'penalty_tier', v_penalty_tier,
    'already_submitted', false,
    'refund_submit_status', null,
    'path', 'fresh'
  );
end;
$function$;

-- Patched: payment_commit_refund_after_gateway.sql
CREATE OR REPLACE FUNCTION public.payment_commit_refund_after_gateway(p_service_id uuid, p_actor_id uuid, p_cancellation_reason text DEFAULT NULL::text, p_initiator text DEFAULT 'client'::text, p_expected_refund_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_service public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_reason text;
  v_exec_at timestamptz;
  v_charge_amount numeric(12, 2);
  v_refund jsonb;
  v_refund_amount numeric(12, 2);
  v_penalty_tier text;
  v_actor public.payment_audit_actor;
  v_already_submitted boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_commit_refund_after_gateway'
      using errcode = '42501';
  end if;

  if p_service_id is null or p_actor_id is null then
    raise exception 'p_service_id and p_actor_id are required'
      using errcode = '22023';
  end if;

  if p_initiator not in ('client', 'provider') then
    raise exception 'INVALID_INITIATOR'
      using errcode = 'P0001';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = p_service_id
  for update;

  if not found then
    raise exception 'SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_initiator = 'client' and v_service.client_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_initiator = 'provider' and v_service.provider_id <> p_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_service.status in (
    'COMPLETED'::public.contracted_service_status,
    'IN_DISPUTE'::public.contracted_service_status
  ) then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_service_id
    and ps.state = 'PAID'::public.payment_schedule_state
  for update;

  if found then
    if v_schedule.gateway_transaction_id is null then
      raise exception 'TRANSACTION_NOT_FOUND'
        using errcode = 'P0001';
    end if;

    v_exec_at := public.payment_service_execution_at(v_service);

    v_charge_amount := coalesce(
      v_schedule.paid_amount,
      public.payment_calculate_charge_amount(
        v_schedule.client_card_token_id,
        v_schedule.base_amount,
        v_schedule.installment_number
      )
    );

    v_refund := public.payment_calculate_refund_amount(
      v_charge_amount,
      v_schedule.base_amount,
      v_exec_at,
      p_initiator
    );

    v_refund_amount := (v_refund->>'refund_amount')::numeric(12, 2);
    v_penalty_tier := v_refund->>'penalty_tier';

    if p_expected_refund_amount is not null then
      if abs(p_expected_refund_amount - v_refund_amount) > 0.01 then
        raise exception 'INVALID_REFUND_AMOUNT'
          using errcode = 'P0001';
      end if;
      v_refund_amount := round(p_expected_refund_amount::numeric, 2);
    end if;

    v_reason := coalesce(
      nullif(btrim(p_cancellation_reason), ''),
      case p_initiator
        when 'client' then 'CLIENT_INITIATED'
        else 'PROVIDER_INITIATED'
      end
    );

    v_actor := case p_initiator
      when 'client' then 'client'::public.payment_audit_actor
      else 'provider'::public.payment_audit_actor
    end;

    update public.payment_schedules ps
    set
      state = 'REFUND_REQUESTED'::public.payment_schedule_state,
      refunded_amount = v_refund_amount,
      refund_submit_status = 'SUBMITTED'::public.payment_refund_submit_status,
      cancellation_reason = v_reason,
      updated_at = now()
    where ps.id = v_schedule.id;

    perform public.payment_complete_refund_domain_side_effects(
      p_service_id := p_service_id,
      p_closed_by_user_id := p_actor_id,
      p_initiator := p_initiator,
      p_cancellation_reason := v_reason,
      p_refund_tier := v_penalty_tier
    );

    perform public.payment_write_audit(
      p_event_type := 'REFUND_SUBMITTED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule.id,
      p_service_id := p_service_id,
      p_schedule_id := v_schedule.id,
      p_from_state := v_schedule.state::text,
      p_to_state := 'REFUND_REQUESTED',
      p_actor := v_actor,
      p_actor_id := p_actor_id,
      p_metadata := jsonb_build_object(
        'refund_amount', v_refund_amount,
        'penalty_tier', v_penalty_tier,
        'charge_amount', v_charge_amount,
        'cancellation_reason', v_reason,
        'initiator', p_initiator,
        'refund_submit_status', 'SUBMITTED'
      )
    );

    perform public.payment_write_event(
      p_event_type := 'RefundRequested',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_schedule.id,
      p_service_id := p_service_id,
      p_payload := jsonb_build_object(
        'refund_amount', v_refund_amount,
        'penalty_tier', v_penalty_tier,
        'initiator', p_initiator
      )
    );

    return jsonb_build_object(
      'schedule_id', v_schedule.id,
      'gateway_transaction_id', v_schedule.gateway_transaction_id,
      'paid_amount', v_schedule.paid_amount,
      'base_amount', v_schedule.base_amount,
      'charge_amount', v_charge_amount,
      'refund_amount', v_refund_amount,
      'penalty_tier', v_penalty_tier,
      'already_submitted', false,
      'refund_submit_status', 'SUBMITTED',
      'path', 'fresh'
    );
  end if;

  if exists (
    select 1
    from public.payment_schedules ps
    where ps.contracted_service_id = p_service_id
      and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
  ) then
    select ps.*
    into v_schedule
    from public.payment_schedules ps
    where ps.contracted_service_id = p_service_id
      and ps.state = 'REFUND_REQUESTED'::public.payment_schedule_state
    for update;

    v_already_submitted := v_schedule.refund_submit_status in (
      'SUBMITTED'::public.payment_refund_submit_status,
      'CONFIRMED'::public.payment_refund_submit_status
    );

    v_reason := coalesce(
      nullif(btrim(p_cancellation_reason), ''),
      nullif(btrim(v_schedule.cancellation_reason), ''),
      nullif(btrim(v_service.cancellation_reason), ''),
      case p_initiator
        when 'client' then 'CLIENT_INITIATED'
        else 'PROVIDER_INITIATED'
      end
    );

    v_exec_at := public.payment_service_execution_at(v_service);
    v_charge_amount := coalesce(
      v_schedule.paid_amount,
      public.payment_calculate_charge_amount(
        v_schedule.client_card_token_id,
        v_schedule.base_amount,
        v_schedule.installment_number
      )
    );
    v_refund := public.payment_calculate_refund_amount(
      v_charge_amount,
      v_schedule.base_amount,
      v_exec_at,
      p_initiator
    );
    v_penalty_tier := v_refund->>'penalty_tier';
    v_refund_amount := coalesce(
      v_schedule.refunded_amount,
      (v_refund->>'refund_amount')::numeric(12, 2)
    );

    if v_already_submitted then
      perform public.payment_complete_refund_domain_side_effects(
        p_service_id := p_service_id,
        p_closed_by_user_id := p_actor_id,
        p_initiator := p_initiator,
        p_cancellation_reason := v_reason,
        p_refund_tier := v_penalty_tier
      );

      return jsonb_build_object(
        'schedule_id', v_schedule.id,
        'gateway_transaction_id', v_schedule.gateway_transaction_id,
        'paid_amount', v_schedule.paid_amount,
        'base_amount', v_schedule.base_amount,
        'charge_amount', v_charge_amount,
        'refund_amount', v_refund_amount,
        'penalty_tier', v_penalty_tier,
        'already_submitted', true,
        'refund_submit_status', v_schedule.refund_submit_status,
        'path', 'already_submitted'
      );
    end if;

    -- Greenfield: REFUND_REQUESTED without gateway ACK must not exist.
    raise exception 'INVALID_SCHEDULE_STATE'
      using errcode = 'P0001';
  end if;

  raise exception 'INVALID_SCHEDULE_STATE'
    using errcode = 'P0001';
end;
$function$;

-- Patched: cns_confirm_service_cancellation.sql
CREATE OR REPLACE FUNCTION public.cns_confirm_service_cancellation(p_contracted_service_id uuid, p_cancellation_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_cs public.contracted_services%rowtype;
  v_schedule public.payment_schedules%rowtype;
  v_actor_id uuid;
  v_initiator text;
  v_schedule_id uuid;
  v_payment jsonb;
begin
  if p_contracted_service_id is null then
    raise exception 'p_contracted_service_id is required'
      using errcode = '22023';
  end if;

  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required for cns_confirm_service_cancellation'
      using errcode = '42501';
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = p_contracted_service_id
  for update;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_actor_id = v_cs.client_id then
    v_initiator := 'client';
  elsif v_actor_id = v_cs.provider_id then
    v_initiator := 'provider';
  else
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_cs.status = 'CANCELLED'::public.contracted_service_status then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'contracted_service_id', p_contracted_service_id
    );
  end if;

  if v_cs.status in (
    'COMPLETED'::public.contracted_service_status,
    'IN_DISPUTE'::public.contracted_service_status
  ) then
    raise exception 'SERVICE_NOT_CANCELLABLE'
      using errcode = 'P0001';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.contracted_service_id = p_contracted_service_id
    and not public.payment_schedule_state_is_terminal(ps.state)
  for update;

  if not found then
    perform public.cns_cancel_active_service_reschedule_requests(p_contracted_service_id);

    update public.contracted_services cs
    set
      status = 'CANCELLED'::public.contracted_service_status,
      cancellation_reason = coalesce(
        nullif(btrim(p_cancellation_reason), ''),
        case v_initiator
          when 'client' then 'CLIENT_INITIATED'
          else 'PROVIDER_INITIATED'
        end
      )
    where cs.id = p_contracted_service_id;

    return jsonb_build_object(
      'outcome', 'cancelled_no_schedule',
      'contracted_service_id', p_contracted_service_id,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state = 'IN_ANALYSIS'::public.payment_schedule_state then
    raise exception 'PAYMENT_IN_ANALYSIS'
      using errcode = 'P0001';
  end if;

  if v_schedule.state in (
    'SCHEDULED'::public.payment_schedule_state,
    'FAILED'::public.payment_schedule_state,
    'FAILED_PERMANENT'::public.payment_schedule_state
  ) then
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('role', 'service_role')::text,
      true
    );

    v_schedule_id := public.payment_pre_charge_cancel(
      p_service_id := p_contracted_service_id,
      p_actor_id := v_actor_id,
      p_cancellation_reason := p_cancellation_reason,
      p_initiator := v_initiator
    );

    raise log 'cns_confirm_service_cancellation service_id=% actor_id=% outcome=pre_charge_cancelled schedule_id=%',
      p_contracted_service_id,
      v_actor_id,
      v_schedule_id;

    return jsonb_build_object(
      'outcome', 'pre_charge_cancelled',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule_id,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state in (
    'PAID'::public.payment_schedule_state,
    'REFUND_REQUESTED'::public.payment_schedule_state
  ) then
    return jsonb_build_object(
      'outcome', 'requires_process_refund_ef',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule.id,
      'schedule_state', v_schedule.state,
      'initiator', v_initiator
    );
  end if;

  if v_schedule.state = 'CANCELLED'::public.payment_schedule_state then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'contracted_service_id', p_contracted_service_id,
      'schedule_id', v_schedule.id
    );
  end if;

  raise exception 'INVALID_SCHEDULE_STATE'
    using errcode = 'P0001';
end;
$function$;


-- get_client_pending_evaluation_prompt already filters status = EXECUTED only,
-- so IN_DISPUTE rows are excluded without a function body change.
