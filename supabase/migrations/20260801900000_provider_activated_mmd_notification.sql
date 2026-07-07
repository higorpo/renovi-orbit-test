-- Payment: MMD templates + routing for PROVIDER_ACTIVATED (NetCred onboarding cron).

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
    'account.provider_activated',
    'push',
    'Credenciamento aprovado',
    'Seu credenciamento de pagamentos foi aprovado. Você já pode receber pagamentos pela plataforma.',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'account.provider_activated',
    'email',
    'Credenciamento de pagamentos aprovado',
    '<p>Seu credenciamento de pagamentos na Renovi foi aprovado.</p><p>Você já pode receber pagamentos e seguir com novos trabalhos na plataforma.</p><p><a href="{{deep_link_path}}">Acessar o app</a></p>',
    '{"type":"object","properties":{"provider_id":{"type":"string"},"provider_gateway_account_id":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["provider_id","deep_link_path"],"additionalProperties":true}'::jsonb,
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
      v_channels := array['push']::message_dispatcher.message_channel[];
      v_push_bypass_limits := false;
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
  'Platform → MMD bridge: CNS + payment lifecycle events (design.md §1.7.9).';

create or replace function public.payment_activate_provider_from_netcred(
  p_provider_gateway_account_id uuid,
  p_netcred_company_id text,
  p_netcred_bank_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_account public.provider_gateway_accounts%rowtype;
  v_mmd jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_activate_provider_from_netcred'
      using errcode = '42501';
  end if;

  if p_provider_gateway_account_id is null then
    raise exception 'p_provider_gateway_account_id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_netcred_company_id), '') is null
    or nullif(btrim(p_netcred_bank_account_id), '') is null then
    raise exception 'NETCRED_IDS_REQUIRED'
      using errcode = '22023';
  end if;

  select pga.*
  into v_account
  from public.provider_gateway_accounts pga
  where pga.id = p_provider_gateway_account_id
  for update;

  if not found then
    raise exception 'PROVIDER_GATEWAY_ACCOUNT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_account.onboarding_status not in (
    'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
    'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
  ) then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  update public.provider_gateway_accounts pga
  set
    onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status,
    netcred_company_id = btrim(p_netcred_company_id),
    netcred_bank_account_id = btrim(p_netcred_bank_account_id),
    onboarding_activated_at = now(),
    updated_at = now()
  where pga.id = p_provider_gateway_account_id;

  perform public.payment_write_audit(
    p_event_type := 'PROVIDER_ACTIVATED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := p_provider_gateway_account_id,
    p_from_state := v_account.onboarding_status::text,
    p_to_state := 'ACTIVE',
    p_actor := 'cron'::public.payment_audit_actor,
    p_actor_id := v_account.provider_id,
    p_metadata := jsonb_build_object(
      'netcred_company_id', btrim(p_netcred_company_id),
      'netcred_bank_account_id', btrim(p_netcred_bank_account_id),
      'gateway_slug', v_account.gateway_slug
    )
  );

  perform public.payment_write_event(
    p_event_type := 'ProviderCredentialed',
    p_aggregate_type := 'provider_gateway_account',
    p_aggregate_id := p_provider_gateway_account_id,
    p_payload := jsonb_build_object(
      'provider_id', v_account.provider_id,
      'netcred_company_id', btrim(p_netcred_company_id),
      'netcred_bank_account_id', btrim(p_netcred_bank_account_id)
    )
  );

  v_mmd := public.mmd_ingest_event(
    'PROVIDER_ACTIVATED',
    v_account.provider_id,
    format('provider-activated:%s', p_provider_gateway_account_id),
    jsonb_build_object(
      'provider_gateway_account_id', p_provider_gateway_account_id,
      'provider_id', v_account.provider_id,
      'deep_link_path', '/dashboard'
    ),
    jsonb_build_object(
      'source', 'payment_activate_provider_from_netcred',
      'gateway_slug', v_account.gateway_slug
    )
  );

  return jsonb_build_object(
    'provider_gateway_account_id', p_provider_gateway_account_id,
    'provider_id', v_account.provider_id,
    'onboarding_status', 'ACTIVE',
    'netcred_company_id', btrim(p_netcred_company_id),
    'netcred_bank_account_id', btrim(p_netcred_bank_account_id),
    'mmd', v_mmd
  );
end;
$$;

comment on function public.payment_activate_provider_from_netcred(uuid, text, text) is
  'Atomically activates provider gateway account from NetCred onboarding detection (service_role only).';

revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from public;
revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from anon;
revoke all on function public.payment_activate_provider_from_netcred(uuid, text, text) from authenticated;

grant execute on function public.payment_activate_provider_from_netcred(uuid, text, text) to service_role;
