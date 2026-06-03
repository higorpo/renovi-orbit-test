-- CNS Phase 5 — task 43: domain event → MMD notification consumer (design §4.10, §1.5, Req. 12, 28).
-- Migration order: runs AFTER task 42 (cns_mmd_ingest).

create or replace function public.cns_message_preview_text(
  p_message_type public.cns_message_type,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_message_type
    when 'IMAGE'::public.cns_message_type then '📷 Foto'
    when 'PROPOSAL'::public.cns_message_type then '📋 Proposta enviada'
    when 'SYSTEM'::public.cns_message_type then coalesce(
      nullif(trim(p_payload->>'text'), ''),
      'Mensagem do sistema'
    )
    when 'WORKFLOW_ACTION'::public.cns_message_type then coalesce(
      nullif(trim(p_payload->>'text'), ''),
      'Atualização'
    )
    else left(
      coalesce(nullif(trim(p_payload->>'text'), ''), 'Nova mensagem'),
      120
    )
  end;
$$;

comment on function public.cns_message_preview_text(public.cns_message_type, jsonb) is
  'Inbox and push preview label for chat messages (R17-AC03).';

create or replace function public.cns_enqueue_notifications(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_event public.domain_events%rowtype;
  v_chat public.chats%rowtype;
  v_sr public.service_requests%rowtype;
  v_message public.chat_messages%rowtype;
  v_recipient_id uuid;
  v_actor_id uuid;
  v_sender_name text;
  v_message_preview text;
  v_proposal_id uuid;
  v_idempotency_key text;
  v_template_variables jsonb;
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

  if v_event.event_type not in (
    'CHAT_MESSAGE_SENT',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_EXPIRED',
    'PROPOSAL_REVISION_REQUESTED',
    'CONVERSATION_CLOSED'
  ) then
    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'skipped', true,
      'reason', 'not_a_notification_event'
    );
  end if;

  if v_event.chat_id is null then
    raise log 'NOTIFICATION_SKIPPED event_id=% event_type=% reason=missing_chat_id',
      v_event.id,
      v_event.event_type;

    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'skipped', true,
      'reason', 'missing_chat_id'
    );
  end if;

  select *
  into v_chat
  from public.chats c
  where c.id = v_event.chat_id;

  if not found then
    raise log 'NOTIFICATION_SKIPPED event_id=% event_type=% reason=chat_not_found chat_id=%',
      v_event.id,
      v_event.event_type,
      v_event.chat_id;

    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'skipped', true,
      'reason', 'chat_not_found'
    );
  end if;

  select *
  into v_sr
  from public.service_requests sr
  where sr.id = coalesce(v_event.service_request_id, v_chat.service_request_id);

  v_proposal_id := coalesce(
    nullif(v_event.payload->>'proposal_id', '')::uuid,
    case
      when v_event.aggregate_type = 'proposal' then v_event.aggregate_id
      else null
    end
  );

  case v_event.event_type
    when 'CHAT_MESSAGE_SENT' then
      v_actor_id := nullif(v_event.payload->>'sender_user_id', '')::uuid;

      if v_actor_id is null then
        raise log 'NOTIFICATION_SKIPPED event_id=% reason=missing_sender_user_id',
          v_event.id;
        return jsonb_build_object(
          'event_id', v_event.id,
          'event_type', v_event.event_type,
          'skipped', true,
          'reason', 'missing_sender_user_id'
        );
      end if;

      v_recipient_id := case
        when v_actor_id = v_chat.client_id then v_chat.provider_id
        when v_actor_id = v_chat.provider_id then v_chat.client_id
        else null
      end;

      select *
      into v_message
      from public.chat_messages m
      where m.id = v_event.aggregate_id;

      v_message_preview := public.cns_message_preview_text(
        v_message.message_type,
        v_message.payload
      );
      v_idempotency_key := format('chat_message:%s:push', v_event.aggregate_id);

    when 'PROPOSAL_SUBMITTED' then
      v_recipient_id := v_chat.client_id;
      v_actor_id := v_chat.provider_id;
      v_message_preview := 'New proposal received';
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('proposal:%s:submitted', v_proposal_id)
      );

    when 'PROPOSAL_ACCEPTED' then
      v_recipient_id := v_chat.provider_id;
      v_actor_id := v_chat.client_id;
      v_message_preview := 'Proposal accepted';
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('proposal:%s:accepted', v_proposal_id)
      );

    when 'PROPOSAL_REJECTED' then
      v_recipient_id := v_chat.provider_id;
      v_actor_id := v_chat.client_id;
      v_message_preview := coalesce(
        nullif(trim(v_event.payload->>'rejection_reason'), ''),
        'Proposal rejected'
      );
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('proposal:%s:rejected', v_proposal_id)
      );

    when 'PROPOSAL_REVISION_REQUESTED' then
      v_recipient_id := v_chat.provider_id;
      v_actor_id := v_chat.client_id;
      v_message_preview := 'Revision requested';
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('proposal:%s:revision_requested', v_proposal_id)
      );

    when 'PROPOSAL_EXPIRED' then
      v_recipient_id := v_chat.provider_id;
      v_actor_id := null;
      v_message_preview := 'Proposal expired';
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('proposal:%s:expired', v_proposal_id)
      );

    when 'CONVERSATION_CLOSED' then
      v_actor_id := nullif(v_event.payload->>'closed_by_user_id', '')::uuid;
      v_recipient_id := case
        when v_actor_id = v_chat.client_id then v_chat.provider_id
        when v_actor_id = v_chat.provider_id then v_chat.client_id
        else v_chat.client_id
      end;
      v_message_preview := coalesce(
        nullif(trim(v_event.payload->>'closure_reason'), ''),
        'Conversation closed'
      );
      v_idempotency_key := coalesce(
        nullif(v_event.payload->>'idempotency_key', ''),
        format('chat:%s:closed', v_chat.id)
      );
  end case;

  if v_recipient_id is null then
    raise log 'NOTIFICATION_SKIPPED event_id=% event_type=% reason=recipient_unresolved',
      v_event.id,
      v_event.event_type;

    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'skipped', true,
      'reason', 'recipient_unresolved'
    );
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'User')
  into v_sender_name
  from public.profiles p
  where p.id = v_actor_id;

  if v_sender_name is null and v_event.event_type = 'PROPOSAL_EXPIRED' then
    v_sender_name := 'Renovi';
  elsif v_sender_name is null then
    v_sender_name := 'User';
  end if;

  v_template_variables := jsonb_build_object(
    'chat_id', v_chat.id,
    'service_request_id', v_sr.id,
    'service_request_title', coalesce(v_sr.title, 'Service request'),
    'sender_display_name', v_sender_name,
    'message_preview', v_message_preview,
    'deep_link_path', format('/dashboard/chats/%s', v_chat.id)
  );

  if v_proposal_id is not null then
    v_template_variables := v_template_variables || jsonb_build_object(
      'proposal_id', v_proposal_id
    );
  end if;

  v_result := public.cns_mmd_ingest(
    v_event.event_type,
    v_recipient_id,
    v_idempotency_key,
    v_template_variables,
    jsonb_build_object(
      'domain_event_id', v_event.id,
      'aggregate_type', v_event.aggregate_type,
      'aggregate_id', v_event.aggregate_id
    )
  );

  raise log 'cns_notification_enqueue_total event_id=% event_type=% ingested=% skipped=%',
    v_event.id,
    v_event.event_type,
    coalesce((v_result->>'ingested_count')::int, 0),
    coalesce((v_result->>'skipped_count')::int, 0);

  return v_result || jsonb_build_object(
    'event_id', v_event.id,
    'recipient_profile_id', v_recipient_id
  );
end;
$$;

comment on function public.cns_enqueue_notifications(uuid) is
  'Domain event consumer: routes notification events to cns_mmd_ingest with §5.5 template variables (R12-AC01, R12-AC03, R12-AC06, R7-AC05).';

revoke all on function public.cns_enqueue_notifications(uuid) from public;
revoke all on function public.cns_enqueue_notifications(uuid) from authenticated;
revoke all on function public.cns_enqueue_notifications(uuid) from anon;

grant execute on function public.cns_enqueue_notifications(uuid) to service_role;
