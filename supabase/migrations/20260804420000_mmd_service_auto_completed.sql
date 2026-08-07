-- Service completion Task 42: seed SERVICE_AUTO_COMPLETED MMD template + ingest routing.
-- Closes unsupported_event_type gap for service_completion_auto_complete_executed (Task 37).

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
    'service.service_auto_completed',
    'push',
    'Serviço concluído automaticamente — {{service_request_title}}',
    'O prazo de confirmação expirou e o serviço foi concluído. Você ainda pode avaliar o prestador se quiser.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"provider_id":{"type":"string"},"client_id":{"type":"string"},"completed_by":{"type":"string"},"optional_rating_cta":{"type":"boolean"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

create or replace function public.mmd_ingest_event(
  p_event_type text,
  p_recipient_profile_id uuid,
  p_idempotency_key text,
  p_template_variables jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
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
$$;

comment on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) is
  'Platform → MMD bridge: CNS + payment + service completion/reschedule lifecycle events.';
