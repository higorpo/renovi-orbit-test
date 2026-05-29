-- CNS Wave B — task 23: transactional outbox insert helper (design §3.8, §4.10).
-- Migration order: runs AFTER tasks 14–21 (timestamps 20260701101300–20260701102000). See docs/chats/tasks.md §Migration file order.

create or replace function public.record_domain_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_service_request_id uuid default null,
  p_chat_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_normative_types constant text[] := array[
    'CHAT_MESSAGE_SENT',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_EXPIRED',
    'PROPOSAL_REVISION_REQUESTED',
    'CONVERSATION_INACTIVATED',
    'CONVERSATION_CLOSED',
    'CHATS_CLOSED_BULK',
    'SLOT_RELEASED',
    'SERVICE_REQUEST_COMPLETED',
    'SERVICE_REQUEST_CANCELLED',
    'NEGOTIATION_TERMINATED'
  ];
  v_notification_events constant text[] := array[
    'CHAT_MESSAGE_SENT',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_ACCEPTED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_EXPIRED',
    'PROPOSAL_REVISION_REQUESTED',
    'CONVERSATION_CLOSED',
    'CHATS_CLOSED_BULK',
    'SERVICE_REQUEST_COMPLETED',
    'SERVICE_REQUEST_CANCELLED'
  ];
begin
  if p_event_type is null or not (p_event_type = any (v_normative_types)) then
    raise exception 'UNKNOWN_DOMAIN_EVENT_TYPE: %', coalesce(p_event_type, '<null>')
      using errcode = '22023';
  end if;

  if nullif(btrim(p_aggregate_type), '') is null then
    raise exception 'p_aggregate_type is required'
      using errcode = '22023';
  end if;

  if p_aggregate_id is null then
    raise exception 'p_aggregate_id is required'
      using errcode = '22023';
  end if;

  if p_payload is null then
    raise exception 'p_payload must not be null'
      using errcode = '22023';
  end if;

  if p_event_type = 'CHATS_CLOSED_BULK' then
    if p_service_request_id is null
      and nullif(p_payload->>'service_request_id', '') is null then
      raise exception 'CHATS_CLOSED_BULK requires service_request_id column or payload.service_request_id'
        using errcode = '22023';
    end if;

    if not (
      (p_payload ? 'chat_ids' and jsonb_typeof(p_payload->'chat_ids') = 'array')
      or (
        p_payload ? 'closed_count'
        and (p_payload->>'closed_count') ~ '^[0-9]+$'
        and (p_payload->>'closed_count')::int >= 0
      )
    ) then
      raise exception 'CHATS_CLOSED_BULK payload requires chat_ids (uuid[]) or closed_count (non-negative int)'
        using errcode = '22023';
    end if;
  end if;

  if p_event_type = any (v_notification_events) then
    if nullif(btrim(p_payload->>'idempotency_key'), '') is null then
      raise exception 'payload.idempotency_key required for notification event %', p_event_type
        using errcode = '22023';
    end if;
  end if;

  insert into public.domain_events (
    event_type,
    aggregate_type,
    aggregate_id,
    service_request_id,
    chat_id,
    payload
  )
  values (
    p_event_type,
    btrim(p_aggregate_type),
    p_aggregate_id,
    p_service_request_id,
    p_chat_id,
    p_payload
  )
  returning id into v_event_id;

  raise log 'domain_event_inserted event_type=% event_id=% service_request_id=% chat_id=%',
    p_event_type,
    v_event_id,
    p_service_request_id,
    p_chat_id;

  return v_event_id;
end;
$$;

comment on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) is
  'CNS outbox helper: validates normative event_type and payload; called inside mutation RPC transactions. No authenticated grant.';

revoke all on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) from authenticated;
revoke all on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) from anon;

grant execute on function public.record_domain_event(text, text, uuid, uuid, uuid, jsonb) to service_role;
