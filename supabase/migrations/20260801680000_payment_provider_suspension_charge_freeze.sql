-- Payment Task 88: provider suspension — charge freeze, client MMD, cron skip (Req 14 AC8, Req 29 AC6).

alter table public.payment_schedules
  add column if not exists charge_frozen_at timestamptz;

comment on column public.payment_schedules.charge_frozen_at is
  'Set when provider is suspended; cron and manual charge skip until ops unfreezes via payment_unfreeze_schedule.';

create index if not exists payment_schedules_charge_frozen_idx
  on public.payment_schedules (charge_frozen_at)
  where charge_frozen_at is not null;

-- Allow ACTIVE -> SUSPENDED admin transition (still blocks ACTIVE -> other states).
create or replace function public.provider_gateway_accounts_guard_onboarding_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE'
    or old.onboarding_status is not distinct from new.onboarding_status then
    return new;
  end if;

  if old.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    and new.onboarding_status <> old.onboarding_status
    and new.onboarding_status <> 'SUSPENDED'::public.payment_provider_onboarding_status then
    raise exception 'PROVIDER_ONBOARDING_TERMINAL_ACTIVE'
      using errcode = 'P0001';
  end if;

  if not (
    (old.onboarding_status = 'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
      and new.onboarding_status in (
        'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
        'PENDING_DOCUMENTS'::public.payment_provider_onboarding_status
      ))
    or (old.onboarding_status = 'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
      and new.onboarding_status in (
        'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status,
        'ACTIVE'::public.payment_provider_onboarding_status,
        'REJECTED'::public.payment_provider_onboarding_status,
        'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status
      ))
    or (old.onboarding_status = 'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
      and new.onboarding_status in (
        'ACTIVE'::public.payment_provider_onboarding_status,
        'REJECTED'::public.payment_provider_onboarding_status,
        'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
      ))
    or (old.onboarding_status = 'REJECTED'::public.payment_provider_onboarding_status
      and new.onboarding_status = 'REJECTED'::public.payment_provider_onboarding_status)
    or (old.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
      and new.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status)
    or (old.onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
      and new.onboarding_status in (
        'SUSPENDED'::public.payment_provider_onboarding_status,
        'ACTIVE'::public.payment_provider_onboarding_status
      ))
  ) then
    raise exception 'PROVIDER_ONBOARDING_INVALID_TRANSITION'
      using errcode = 'P0001';
  end if;

  if new.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    and nullif(btrim(new.netcred_company_id), '') is null then
    raise exception 'PROVIDER_NETCRED_COMPANY_ID_REQUIRED'
      using errcode = 'P0001';
  end if;

  if new.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    and nullif(btrim(new.netcred_bank_account_id), '') is null then
    raise exception 'PROVIDER_NETCRED_BANK_ACCOUNT_ID_REQUIRED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.suspend_provider(
  p_provider_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_account public.provider_gateway_accounts%rowtype;
  v_schedule record;
  v_frozen_count int := 0;
  v_notifications jsonb := '[]'::jsonb;
  v_notify jsonb;
  v_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for suspend_provider'
      using errcode = '42501';
  end if;

  if p_provider_id is null then
    raise exception 'p_provider_id is required'
      using errcode = '22023';
  end if;

  select pga.*
  into v_account
  from public.provider_gateway_accounts pga
  where pga.provider_id = p_provider_id
    and pga.gateway_slug = 'netcred'::public.payment_gateway_slug
  for update;

  if not found then
    raise exception 'PROVIDER_GATEWAY_ACCOUNT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_account.onboarding_status <> 'ACTIVE'::public.payment_provider_onboarding_status then
    raise exception 'INVALID_ONBOARDING_STATE'
      using errcode = 'P0001';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'ADMIN_SUSPENSION');

  update public.provider_gateway_accounts pga
  set onboarding_status = 'SUSPENDED'::public.payment_provider_onboarding_status
  where pga.id = v_account.id;

  perform public.payment_write_audit(
    p_event_type := 'PROVIDER_SUSPENDED',
    p_entity_type := 'provider_gateway_account',
    p_entity_id := v_account.id,
    p_service_id := null,
    p_schedule_id := null,
    p_from_state := v_account.onboarding_status::text,
    p_to_state := 'SUSPENDED',
    p_actor := 'system'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'provider_id', p_provider_id,
      'reason', v_reason
    )
  );

  v_notify := public.mmd_ingest_event(
    'PROVIDER_SUSPENDED',
    p_provider_id,
    format('provider-suspended:%s:provider', v_account.id),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'deep_link_path', '/dashboard/profile'
    ),
    jsonb_build_object(
      'source', 'suspend_provider',
      'recipient', 'provider'
    )
  );

  v_notifications := v_notifications || jsonb_build_array(v_notify);

  for v_schedule in
    select
      ps.id as schedule_id,
      ps.contracted_service_id,
      ps.client_id,
      cs.service_request_id,
      coalesce(nullif(trim(sr.title), ''), 'Serviço') as service_request_title
    from public.payment_schedules ps
    join public.contracted_services cs on cs.id = ps.contracted_service_id
    join public.service_requests sr on sr.id = cs.service_request_id
    where ps.provider_id = p_provider_id
      and cs.status = 'PENDING_PAYMENT'::public.contracted_service_status
      and ps.state in (
        'SCHEDULED'::public.payment_schedule_state,
        'FAILED'::public.payment_schedule_state,
        'FAILED_PERMANENT'::public.payment_schedule_state
      )
      and ps.charge_frozen_at is null
    for update of ps
  loop
    update public.payment_schedules ps
    set
      charge_frozen_at = now(),
      updated_at = now()
    where ps.id = v_schedule.schedule_id;

    v_frozen_count := v_frozen_count + 1;

    perform public.payment_write_audit(
      p_event_type := 'CHARGE_FROZEN',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_schedule.schedule_id,
      p_service_id := v_schedule.contracted_service_id,
      p_schedule_id := v_schedule.schedule_id,
      p_actor := 'system'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'provider_id', p_provider_id,
        'reason', v_reason
      )
    );

    v_notify := public.mmd_ingest_event(
      'PROVIDER_SUSPENDED',
      v_schedule.client_id,
      format('provider-suspended:%s:client', v_schedule.schedule_id),
      jsonb_build_object(
        'schedule_id', v_schedule.schedule_id,
        'contracted_service_id', v_schedule.contracted_service_id,
        'provider_id', p_provider_id,
        'service_request_title', v_schedule.service_request_title,
        'deep_link_path', format('/dashboard/services/%s', v_schedule.service_request_id),
        'reason', v_reason
      ),
      jsonb_build_object(
        'source', 'suspend_provider',
        'recipient', 'client'
      )
    );

    v_notifications := v_notifications || jsonb_build_array(v_notify);
  end loop;

  raise log 'suspend_provider provider_id=% frozen_schedules=% reason=%',
    p_provider_id,
    v_frozen_count,
    v_reason;

  return jsonb_build_object(
    'provider_id', p_provider_id,
    'onboarding_status', 'SUSPENDED',
    'frozen_schedules', v_frozen_count,
    'notifications', v_notifications
  );
end;
$$;

comment on function public.suspend_provider(uuid, text) is
  'Suspends ACTIVE provider, freezes pre-PAID schedules, notifies provider and affected clients (service_role).';

revoke all on function public.suspend_provider(uuid, text) from public;
revoke all on function public.suspend_provider(uuid, text) from anon;
revoke all on function public.suspend_provider(uuid, text) from authenticated;

grant execute on function public.suspend_provider(uuid, text) to service_role;

create or replace function public.payment_unfreeze_schedule(
  p_schedule_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.payment_schedules%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_unfreeze_schedule'
      using errcode = '42501';
  end if;

  if p_schedule_id is null then
    raise exception 'p_schedule_id is required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id
  for update;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_schedule.charge_frozen_at is null then
    return jsonb_build_object(
      'schedule_id', p_schedule_id,
      'outcome', 'not_frozen'
    );
  end if;

  update public.payment_schedules ps
  set
    charge_frozen_at = null,
    updated_at = now()
  where ps.id = p_schedule_id;

  perform public.payment_write_audit(
    p_event_type := 'CHARGE_UNFROZEN',
    p_entity_type := 'payment_schedule',
    p_entity_id := p_schedule_id,
    p_service_id := v_schedule.contracted_service_id,
    p_schedule_id := p_schedule_id,
    p_actor := 'system'::public.payment_audit_actor,
    p_metadata := jsonb_build_object(
      'provider_id', v_schedule.provider_id,
      'previously_frozen_at', v_schedule.charge_frozen_at
    )
  );

  return jsonb_build_object(
    'schedule_id', p_schedule_id,
    'outcome', 'unfrozen'
  );
end;
$$;

comment on function public.payment_unfreeze_schedule(uuid) is
  'Ops tool: clears charge_frozen_at so cron may resume charging after provider reactivation (service_role).';

revoke all on function public.payment_unfreeze_schedule(uuid) from public;
revoke all on function public.payment_unfreeze_schedule(uuid) from anon;
revoke all on function public.payment_unfreeze_schedule(uuid) from authenticated;

grant execute on function public.payment_unfreeze_schedule(uuid) to service_role;

-- Extend MMD routing for immediate client notification on provider suspension.
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
    when 'PROVIDER_SUSPENDED' then
      v_template_key := 'account.provider_suspended';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_push_bypass_limits := true;
      v_email_bypass_limits := false;
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

-- Skip frozen schedules in charge cron even after provider reactivation.
create or replace function public.payment_claim_charge_batch(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
  v_lease_minutes int;
  v_max_attempts int;
  v_rows jsonb := '[]'::jsonb;
  v_claimed record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_claim_charge_batch'
      using errcode = '42501';
  end if;

  v_batch_size := coalesce(
    p_batch_size,
    public.platform_constant_int('charge_batch_size', 10)
  );
  v_lease_minutes := public.platform_constant_int('payment_lease_duration_minutes', 10);
  v_max_attempts := public.platform_constant_int('max_charge_attempts', 3);

  create temp table _payment_claim_batch_result on commit drop as
  with eligible as materialized (
    select
      ps.id,
      ps.state as from_state,
      ps.contracted_service_id,
      ps.client_id,
      ps.provider_id,
      ps.gateway_slug,
      ps.client_card_token_id,
      ps.installment_number,
      ps.base_amount,
      ps.automatic_attempt_count,
      ps.max_attempts,
      ps.clearsale_session_id,
      ps.client_ip_address,
      public.payment_total_with_card_fees(
        ps.base_amount,
        cct.card_brand,
        ps.installment_number
      ) as charge_amount
    from public.payment_schedules ps
    join public.contracted_services cs on cs.id = ps.contracted_service_id
    join public.client_card_tokens cct
      on cct.id = ps.client_card_token_id
     and cct.state = 'ACTIVE'::public.payment_client_card_token_state
     and cct.client_id = ps.client_id
     and not public.payment_client_card_token_is_expired(cct.expiry_month, cct.expiry_year)
    join public.provider_gateway_accounts pga
      on pga.provider_id = ps.provider_id
     and pga.gateway_slug = ps.gateway_slug
     and pga.onboarding_status = 'ACTIVE'::public.payment_provider_onboarding_status
    where ps.state in ('SCHEDULED', 'FAILED')
      and ps.charge_frozen_at is null
      and ps.automatic_attempt_count < v_max_attempts
      and ps.charge_scheduled_at <= now()
      and (ps.locked_until is null or ps.locked_until < now())
      and (ps.next_retry_at is null or ps.next_retry_at <= now())
      and cs.status not in ('CANCELLED', 'COMPLETED')
    order by ps.charge_scheduled_at
    limit v_batch_size
    for update of ps skip locked
  ),
  claimed as (
    update public.payment_schedules ps
    set
      state = 'PROCESSING',
      locked_until = now() + make_interval(mins => v_lease_minutes),
      automatic_attempt_count = ps.automatic_attempt_count + 1,
      updated_at = now()
    from eligible e
    where ps.id = e.id
    returning
      ps.id,
      e.contracted_service_id,
      e.client_id,
      e.provider_id,
      e.gateway_slug,
      e.client_card_token_id,
      e.installment_number,
      e.base_amount,
      ps.automatic_attempt_count,
      e.max_attempts,
      e.clearsale_session_id,
      e.client_ip_address,
      e.from_state,
      e.charge_amount
  )
  select * from claimed;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_rows
  from _payment_claim_batch_result t;

  for v_claimed in select * from _payment_claim_batch_result loop
    perform public.payment_write_audit(
      p_event_type := 'CHARGE_ATTEMPT_STARTED',
      p_entity_type := 'payment_schedule',
      p_entity_id := v_claimed.id,
      p_service_id := v_claimed.contracted_service_id,
      p_schedule_id := v_claimed.id,
      p_from_state := v_claimed.from_state::text,
      p_to_state := 'PROCESSING',
      p_actor := 'cron'::public.payment_audit_actor,
      p_metadata := jsonb_build_object(
        'automatic_attempt_count', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount
      )
    );

    perform public.payment_write_event(
      p_event_type := 'ChargeAttemptStarted',
      p_aggregate_type := 'payment_schedule',
      p_aggregate_id := v_claimed.id,
      p_service_id := v_claimed.contracted_service_id,
      p_payload := jsonb_build_object(
        'automatic_attempt_count', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount,
        'gateway_slug', v_claimed.gateway_slug,
        'initiator', 'cron'
      )
    );

    perform public.payment_raise_log(
      'charge_attempt_started',
      v_claimed.contracted_service_id,
      v_claimed.id,
      jsonb_build_object(
        'gateway_slug', v_claimed.gateway_slug,
        'attempt_number', v_claimed.automatic_attempt_count,
        'charge_amount', v_claimed.charge_amount,
        'initiator', 'cron'
      )
    );
  end loop;

  return v_rows;
end;
$$;
