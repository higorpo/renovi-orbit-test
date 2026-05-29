-- CNS Phase 5 — task 44: best-effort analytics fan-out from domain events (design §3.18, Req. 21, 28).
-- Migration order: runs AFTER task 7 (domain_events).

create or replace function public.cns_emit_analytics(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_event public.domain_events%rowtype;
  v_chat public.chats%rowtype;
  v_proposal public.provider_proposals%rowtype;
  v_analytics_name text;
  v_properties jsonb := '{}'::jsonb;
  v_lag_seconds numeric;
begin
  if p_event_id is null then
    raise exception 'p_event_id is required'
      using errcode = '22023';
  end if;

  begin
    select *
    into v_event
    from public.domain_events de
    where de.id = p_event_id;

    if not found then
      raise exception 'domain event not found: %', p_event_id
        using errcode = '22023';
    end if;

    v_lag_seconds := extract(epoch from (now() - v_event.created_at));

    case v_event.event_type
      when 'CHAT_MESSAGE_SENT' then
        v_analytics_name := 'negotiation_message_sent';
        v_properties := jsonb_build_object(
          'message_id', v_event.aggregate_id,
          'message_type', v_event.payload->>'message_type',
          'sender_user_id', v_event.payload->>'sender_user_id',
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_SUBMITTED' then
        v_analytics_name := 'proposal_submitted';

        select *
        into v_proposal
        from public.provider_proposals pp
        where pp.id = coalesce(
          nullif(v_event.payload->>'proposal_id', '')::uuid,
          v_event.aggregate_id
        );

        if v_event.chat_id is not null then
          select *
          into v_chat
          from public.chats c
          where c.id = v_event.chat_id;
        end if;

        v_properties := jsonb_build_object(
          'proposal_id', coalesce(v_proposal.id, v_event.aggregate_id),
          'chat_id', coalesce(v_proposal.chat_id, v_event.chat_id),
          'service_request_id', coalesce(v_proposal.service_request_id, v_event.service_request_id),
          'version', v_proposal.version,
          'revision_count', v_proposal.revision_count
        );

        if v_chat.activated_at is not null and v_proposal.submitted_at is not null then
          v_properties := v_properties || jsonb_build_object(
            'time_to_proposal_ms',
            round(
              extract(epoch from (v_proposal.submitted_at - v_chat.activated_at)) * 1000
            )::bigint
          );
        end if;

      when 'PROPOSAL_ACCEPTED' then
        v_analytics_name := 'proposal_accepted';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'service_id', v_event.payload->>'service_id'
        );

      when 'PROPOSAL_REJECTED' then
        v_analytics_name := 'proposal_rejected';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_EXPIRED' then
        v_analytics_name := 'proposal_expired';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id
        );

      when 'PROPOSAL_REVISION_REQUESTED' then
        v_analytics_name := 'revision_requested';
        v_properties := jsonb_build_object(
          'proposal_id', coalesce(nullif(v_event.payload->>'proposal_id', '')::uuid, v_event.aggregate_id),
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'revision_reason', v_event.payload->>'revision_reason'
        );

      when 'CONVERSATION_CLOSED' then
        v_analytics_name := 'conversation_closed';
        v_properties := jsonb_build_object(
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'closure_type', v_event.payload->>'closure_type',
          'closed_by_user_id', v_event.payload->>'closed_by_user_id'
        );

      when 'CONVERSATION_INACTIVATED' then
        v_analytics_name := 'conversation_inactivated';
        v_properties := jsonb_build_object(
          'chat_id', v_event.chat_id,
          'service_request_id', v_event.service_request_id,
          'inactivation_reason', v_event.payload->>'inactivation_reason'
        );

      when 'SERVICE_REQUEST_COMPLETED' then
        v_analytics_name := 'service_request_completed';
        v_properties := jsonb_build_object(
          'service_request_id', coalesce(v_event.service_request_id, v_event.aggregate_id),
          'contracted_service_id', v_event.payload->>'contracted_service_id'
        );

      when 'SERVICE_REQUEST_CANCELLED' then
        v_analytics_name := 'service_request_cancelled';
        v_properties := jsonb_build_object(
          'service_request_id', coalesce(v_event.service_request_id, v_event.aggregate_id)
        );

      else
        return jsonb_build_object(
          'event_id', v_event.id,
          'event_type', v_event.event_type,
          'skipped', true,
          'reason', 'not_analytics_event'
        );
    end case;

    raise log 'cns_analytics_event event_name=% schema_version=v1 domain_event_id=% lag_seconds=% properties=%',
      v_analytics_name,
      v_event.id,
      v_lag_seconds,
      v_properties;

    raise log 'cns_analytics_emit_duration_ms=% domain_event_id=% event_name=%',
      round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint,
      v_event.id,
      v_analytics_name;

    return jsonb_build_object(
      'event_id', v_event.id,
      'event_type', v_event.event_type,
      'analytics_event', v_analytics_name,
      'schema_version', 'v1',
      'lag_seconds', v_lag_seconds,
      'properties', v_properties,
      'skipped', false
    );
  exception
    when others then
      raise log 'cns_analytics_emit_failed domain_event_id=% sqlstate=% message=%',
        p_event_id,
        sqlstate,
        sqlerrm;

      return jsonb_build_object(
        'event_id', p_event_id,
        'skipped', true,
        'reason', sqlerrm
      );
  end;
end;
$$;

comment on function public.cns_emit_analytics(uuid) is
  'Best-effort server-side analytics fan-out from domain_events; failures never propagate (R21-AC03, R28-AC03).';

revoke all on function public.cns_emit_analytics(uuid) from public;
revoke all on function public.cns_emit_analytics(uuid) from authenticated;
revoke all on function public.cns_emit_analytics(uuid) from anon;

grant execute on function public.cns_emit_analytics(uuid) to service_role;
