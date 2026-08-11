-- Notification triggers — extract MMD bridge and per-domain notify helpers from domain_events consumer.

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
  v_bypass_limits boolean;
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
      v_bypass_limits := true;
    when 'PROPOSAL_SUBMITTED' then
      v_template_key := 'proposal.submitted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'PROPOSAL_REVISION_REQUESTED' then
      v_template_key := 'proposal.revision_requested';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'PROPOSAL_ACCEPTED' then
      v_template_key := 'proposal.accepted';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'PROPOSAL_REJECTED' then
      v_template_key := 'proposal.rejected';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'PROPOSAL_EXPIRED' then
      v_template_key := 'proposal.expired';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'PROPOSAL_EXPIRING_SOON' then
      v_template_key := 'proposal.expiring_soon';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
    when 'CONVERSATION_CLOSED' then
      v_template_key := 'chat.closed';
      v_channels := array['push', 'email']::message_dispatcher.message_channel[];
      v_bypass_limits := false;
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
        v_bypass_limits
      );

      v_ingested_count := v_ingested_count + 1;
      v_dispatches := v_dispatches || jsonb_build_array(
        v_dispatch || jsonb_build_object('channel', v_channel)
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
    'bypass_limits', v_bypass_limits,
    'ingested_count', v_ingested_count,
    'skipped_count', v_skipped_count,
    'dispatches', v_dispatches
  );
end;
$$;

comment on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) is
  'Platform → MMD bridge: maps event types to templates/channels/bypass_limits; best-effort per channel.';

create or replace function public.cns_mmd_ingest(
  p_event_type text,
  p_recipient_profile_id uuid,
  p_idempotency_key text,
  p_template_variables jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = public, message_dispatcher
as $$
  select public.mmd_ingest_event(
    p_event_type,
    p_recipient_profile_id,
    p_idempotency_key,
    p_template_variables,
    p_metadata
  );
$$;

comment on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) is
  'Legacy alias for mmd_ingest_event; kept for existing callers (SLA reminders, replay).';

create or replace function public.cns_notify_chat_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_message public.chat_messages%rowtype;
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_recipient_id uuid;
  v_sender_name text;
  v_preview text;
begin
  if p_message_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'missing_message_id');
  end if;

  select *
  into v_message
  from public.chat_messages m
  where m.id = p_message_id;

  if not found then
    raise log 'NOTIFICATION_SKIPPED message_id=% reason=message_not_found', p_message_id;
    return jsonb_build_object('skipped', true, 'reason', 'message_not_found');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_message.chat_id;

  if not found then
    raise log 'NOTIFICATION_SKIPPED message_id=% reason=chat_not_found', p_message_id;
    return jsonb_build_object('skipped', true, 'reason', 'chat_not_found');
  end if;

  v_recipient_id := case
    when v_message.sender_user_id = v_chat.client_id then v_chat.provider_id
    when v_message.sender_user_id = v_chat.provider_id then v_chat.client_id
    else null
  end;

  if v_recipient_id is null then
    raise log 'NOTIFICATION_SKIPPED message_id=% reason=recipient_unresolved', p_message_id;
    return jsonb_build_object('skipped', true, 'reason', 'recipient_unresolved');
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_chat.service_request_id;

  select coalesce(nullif(trim(p.full_name), ''), 'User')
  into v_sender_name
  from public.profiles p
  where p.id = v_message.sender_user_id;

  v_preview := public.cns_message_preview_text(v_message.message_type, v_message.payload);

  return public.mmd_ingest_event(
    'CHAT_MESSAGE_SENT',
    v_recipient_id,
    format('chat_message:%s:push', v_message.id),
    jsonb_build_object(
      'chat_id', v_chat.id,
      'service_request_id', v_sr.id,
      'service_request_title', coalesce(v_sr.title, 'Service request'),
      'sender_display_name', coalesce(v_sender_name, 'User'),
      'message_preview', v_preview,
      'deep_link_path', format('/dashboard/chats/%s', v_chat.id)
    ),
    jsonb_build_object(
      'message_id', v_message.id,
      'aggregate_type', 'chat_message',
      'aggregate_id', v_message.id
    )
  );
end;
$$;

comment on function public.cns_notify_chat_message(uuid) is
  'Chat trigger helper: enqueue push for TEXT/IMAGE/AUDIO messages (best-effort).';

create or replace function public.cns_notify_conversation_closed(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_recipient_id uuid;
  v_sender_name text;
begin
  if p_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'missing_chat_id');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = p_chat_id;

  if not found then
    raise log 'NOTIFICATION_SKIPPED chat_id=% reason=chat_not_found', p_chat_id;
    return jsonb_build_object('skipped', true, 'reason', 'chat_not_found');
  end if;

  if v_chat.closure_type <> 'MANUAL'::public.cns_closure_type then
    return jsonb_build_object('skipped', true, 'reason', 'not_manual_closure');
  end if;

  v_recipient_id := case
    when v_chat.closed_by_user_id = v_chat.client_id then v_chat.provider_id
    when v_chat.closed_by_user_id = v_chat.provider_id then v_chat.client_id
    else v_chat.client_id
  end;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_chat.service_request_id;

  select coalesce(nullif(trim(p.full_name), ''), 'User')
  into v_sender_name
  from public.profiles p
  where p.id = v_chat.closed_by_user_id;

  return public.mmd_ingest_event(
    'CONVERSATION_CLOSED',
    v_recipient_id,
    format('chat:%s:closed', v_chat.id),
    jsonb_build_object(
      'chat_id', v_chat.id,
      'service_request_id', v_sr.id,
      'service_request_title', coalesce(v_sr.title, 'Service request'),
      'sender_display_name', coalesce(v_sender_name, 'User'),
      'message_preview', coalesce(nullif(trim(v_chat.closure_reason), ''), 'Conversation closed'),
      'deep_link_path', format('/dashboard/chats/%s', v_chat.id)
    ),
    jsonb_build_object(
      'chat_id', v_chat.id,
      'closure_type', v_chat.closure_type
    )
  );
end;
$$;

comment on function public.cns_notify_conversation_closed(uuid) is
  'Chat trigger helper: notify other participant on manual conversation close only.';

create or replace function public.notify_proposal_mmd(
  p_proposal_id uuid,
  p_event_type text,
  p_recipient_id uuid,
  p_actor_id uuid,
  p_message_preview text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_chat_id uuid;
  v_sender_name text;
begin
  if p_proposal_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'missing_proposal_id');
  end if;

  if p_recipient_id is null then
    raise log 'NOTIFICATION_SKIPPED proposal_id=% event_type=% reason=recipient_unresolved',
      p_proposal_id,
      p_event_type;
    return jsonb_build_object('skipped', true, 'reason', 'recipient_unresolved');
  end if;

  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    raise log 'NOTIFICATION_SKIPPED proposal_id=% reason=proposal_not_found', p_proposal_id;
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    raise log 'NOTIFICATION_SKIPPED proposal_id=% event_type=% reason=chat_unresolved',
      p_proposal_id,
      p_event_type;
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = v_proposal.service_request_id;

  if p_actor_id is null and p_event_type = 'PROPOSAL_EXPIRED' then
    v_sender_name := 'Prestway';
  else
    select coalesce(nullif(trim(p.full_name), ''), 'User')
    into v_sender_name
    from public.profiles p
    where p.id = p_actor_id;
    v_sender_name := coalesce(v_sender_name, 'User');
  end if;

  return public.mmd_ingest_event(
    p_event_type,
    p_recipient_id,
    p_idempotency_key,
    jsonb_build_object(
      'chat_id', v_chat.id,
      'service_request_id', v_sr.id,
      'service_request_title', coalesce(v_sr.title, 'Service request'),
      'sender_display_name', v_sender_name,
      'message_preview', p_message_preview,
      'deep_link_path', format('/dashboard/chats/%s', v_chat.id),
      'proposal_id', v_proposal.id
    ),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'proposal_id', v_proposal.id,
      'aggregate_type', 'proposal',
      'aggregate_id', v_proposal.id
    )
  );
end;
$$;

comment on function public.notify_proposal_mmd(uuid, text, uuid, uuid, text, text, jsonb) is
  'Shared proposal → MMD enqueue helper for notify_proposal_* trigger functions.';

create or replace function public.notify_proposal_submitted(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
begin
  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  return public.notify_proposal_mmd(
    p_proposal_id,
    'PROPOSAL_SUBMITTED',
    v_chat.client_id,
    v_chat.provider_id,
    'New proposal received',
    format('proposal:%s:submitted', p_proposal_id)
  );
end;
$$;

comment on function public.notify_proposal_submitted(uuid) is
  'Proposal trigger helper: notify client on new PENDING proposal.';

create or replace function public.notify_proposal_accepted(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
begin
  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  return public.notify_proposal_mmd(
    p_proposal_id,
    'PROPOSAL_ACCEPTED',
    v_chat.provider_id,
    v_chat.client_id,
    'Proposal accepted',
    format('proposal:%s:accepted', p_proposal_id)
  );
end;
$$;

comment on function public.notify_proposal_accepted(uuid) is
  'Proposal trigger helper: notify provider when proposal is accepted.';

create or replace function public.notify_proposal_rejected(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
begin
  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  return public.notify_proposal_mmd(
    p_proposal_id,
    'PROPOSAL_REJECTED',
    v_chat.provider_id,
    v_chat.client_id,
    coalesce(nullif(trim(v_proposal.client_rejection_response), ''), 'Proposal rejected'),
    format('proposal:%s:rejected', p_proposal_id),
    jsonb_build_object('rejection_reason', v_proposal.client_rejection_response)
  );
end;
$$;

comment on function public.notify_proposal_rejected(uuid) is
  'Proposal trigger helper: notify provider on manual client rejection.';

create or replace function public.notify_proposal_revision_requested(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
begin
  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  return public.notify_proposal_mmd(
    p_proposal_id,
    'PROPOSAL_REVISION_REQUESTED',
    v_chat.provider_id,
    v_chat.client_id,
    'Revision requested',
    format('proposal:%s:revision_requested', p_proposal_id)
  );
end;
$$;

comment on function public.notify_proposal_revision_requested(uuid) is
  'Proposal trigger helper: notify provider when client requests revision.';

create or replace function public.notify_proposal_expired(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.provider_proposals%rowtype;
  v_chat_id uuid;
  v_chat public.chats%rowtype;
begin
  select *
  into v_proposal
  from public.provider_proposals pp
  where pp.id = p_proposal_id;

  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'proposal_not_found');
  end if;

  v_chat_id := public.resolve_proposal_chat_id(
    v_proposal.service_request_id,
    v_proposal.provider_id
  );

  if v_chat_id is null then
    return jsonb_build_object('skipped', true, 'reason', 'chat_unresolved');
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_chat_id;

  return public.notify_proposal_mmd(
    p_proposal_id,
    'PROPOSAL_EXPIRED',
    v_chat.provider_id,
    null,
    'Proposal expired',
    format('proposal:%s:expired', p_proposal_id),
    jsonb_build_object('expired_at', v_proposal.expired_at)
  );
end;
$$;

comment on function public.notify_proposal_expired(uuid) is
  'Proposal trigger helper: notify provider when proposal expires.';

create or replace function public.notify_proposal_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  case new.status
    when 'ACCEPTED'::public.proposal_status then
      perform public.notify_proposal_accepted(new.id);
    when 'REJECTED'::public.proposal_status then
      perform public.notify_proposal_rejected(new.id);
    when 'REVISION_REQUESTED'::public.proposal_status then
      perform public.notify_proposal_revision_requested(new.id);
    when 'EXPIRED'::public.proposal_status then
      perform public.notify_proposal_expired(new.id);
    else
      null;
  end case;

  return new;
end;
$$;

comment on function public.notify_proposal_status_changed() is
  'Trigger function: routes provider_proposals status transitions to notify_proposal_* (excludes REJECTED_AUTOMATICALLY).';

create or replace function public.cns_enqueue_notifications(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_event public.domain_events%rowtype;
  v_result jsonb;
begin
  if p_event_id is null then
    raise exception 'p_event_id is required'
      using errcode = '22023';
  end if;

  select *
  into v_event
  from public.domain_events de
  where de.id = p_event_id;

  if not found then
    raise exception 'domain event not found: %', p_event_id
      using errcode = '22023';
  end if;

  case v_event.event_type
    when 'CHAT_MESSAGE_SENT' then
      v_result := public.cns_notify_chat_message(v_event.aggregate_id);
    when 'PROPOSAL_SUBMITTED' then
      v_result := public.notify_proposal_submitted(
        coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id)
      );
    when 'PROPOSAL_ACCEPTED' then
      v_result := public.notify_proposal_accepted(
        coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id)
      );
    when 'PROPOSAL_REJECTED' then
      v_result := public.notify_proposal_rejected(
        coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id)
      );
    when 'PROPOSAL_REVISION_REQUESTED' then
      v_result := public.notify_proposal_revision_requested(
        coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id)
      );
    when 'PROPOSAL_EXPIRED' then
      v_result := public.notify_proposal_expired(
        coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id)
      );
    when 'CONVERSATION_CLOSED' then
      v_result := public.cns_notify_conversation_closed(v_event.chat_id);
    else
      return jsonb_build_object(
        'event_id', v_event.id,
        'event_type', v_event.event_type,
        'skipped', true,
        'reason', 'not_a_notification_event'
      );
  end case;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'event_id', v_event.id,
    'event_type', v_event.event_type
  );
end;
$$;

comment on function public.cns_enqueue_notifications(uuid) is
  'Legacy domain_events replay consumer; delegates to cns_notify_* and notify_proposal_* helpers.';

revoke all on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) from public;
revoke all on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) from anon;
grant execute on function public.mmd_ingest_event(text, uuid, text, jsonb, jsonb) to service_role;

revoke all on function public.cns_notify_chat_message(uuid) from public;
revoke all on function public.cns_notify_chat_message(uuid) from authenticated;
revoke all on function public.cns_notify_chat_message(uuid) from anon;
grant execute on function public.cns_notify_chat_message(uuid) to service_role;

revoke all on function public.cns_notify_conversation_closed(uuid) from public;
revoke all on function public.cns_notify_conversation_closed(uuid) from authenticated;
revoke all on function public.cns_notify_conversation_closed(uuid) from anon;
grant execute on function public.cns_notify_conversation_closed(uuid) to service_role;

revoke all on function public.notify_proposal_mmd(uuid, text, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.notify_proposal_mmd(uuid, text, uuid, uuid, text, text, jsonb) from authenticated;
revoke all on function public.notify_proposal_mmd(uuid, text, uuid, uuid, text, text, jsonb) from anon;
grant execute on function public.notify_proposal_mmd(uuid, text, uuid, uuid, text, text, jsonb) to service_role;

revoke all on function public.notify_proposal_submitted(uuid) from public;
revoke all on function public.notify_proposal_submitted(uuid) from authenticated;
revoke all on function public.notify_proposal_submitted(uuid) from anon;
grant execute on function public.notify_proposal_submitted(uuid) to service_role;

revoke all on function public.notify_proposal_accepted(uuid) from public;
revoke all on function public.notify_proposal_accepted(uuid) from authenticated;
revoke all on function public.notify_proposal_accepted(uuid) from anon;
grant execute on function public.notify_proposal_accepted(uuid) to service_role;

revoke all on function public.notify_proposal_rejected(uuid) from public;
revoke all on function public.notify_proposal_rejected(uuid) from authenticated;
revoke all on function public.notify_proposal_rejected(uuid) from anon;
grant execute on function public.notify_proposal_rejected(uuid) to service_role;

revoke all on function public.notify_proposal_revision_requested(uuid) from public;
revoke all on function public.notify_proposal_revision_requested(uuid) from authenticated;
revoke all on function public.notify_proposal_revision_requested(uuid) from anon;
grant execute on function public.notify_proposal_revision_requested(uuid) to service_role;

revoke all on function public.notify_proposal_expired(uuid) from public;
revoke all on function public.notify_proposal_expired(uuid) from authenticated;
revoke all on function public.notify_proposal_expired(uuid) from anon;
grant execute on function public.notify_proposal_expired(uuid) to service_role;
