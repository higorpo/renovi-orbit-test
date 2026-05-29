-- CNS Phase 5 — task 42: MMD ingest SECURITY DEFINER wrapper (design §4.10, Req. 12, 28, 30).
-- Migration order: runs AFTER tasks 7, 21 (MMD templates).

create or replace function public.mmd_idempotency_uuid(p_key text)
returns uuid
language sql
immutable
strict
set search_path = public
as $$
  select (
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-' ||
    substr(h, 13, 4) || '-' ||
    substr(h, 17, 4) || '-' ||
    substr(h, 21, 12)
  )::uuid
  from (select md5(p_key) as h) s;
$$;

comment on function public.mmd_idempotency_uuid(text) is
  'Deterministic UUID for MMD ingest from stable idempotency_key strings (R12-AC04).';

create or replace function public.cns_mmd_ingest(
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

  if nullif(v_variables->>'chat_id', '') is not null
    and nullif(v_variables->>'deep_link_path', '') is null then
    v_variables := v_variables || jsonb_build_object(
      'deep_link_path',
      format('/chats/%s', v_variables->>'chat_id')
    );
  end if;

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

  raise log 'cns_mmd_ingest_duration_ms=% event_type=% ingested=% skipped=%',
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

comment on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) is
  'CNS → MMD bridge: maps domain event types to templates/channels/bypass_limits; failures log NOTIFICATION_SKIPPED (R12-AC01–04, R30-AC02, OAC-09).';

revoke all on function public.mmd_idempotency_uuid(text) from public;
revoke all on function public.mmd_idempotency_uuid(text) from authenticated;
revoke all on function public.mmd_idempotency_uuid(text) from anon;

revoke all on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) from public;
revoke all on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) from anon;

grant execute on function public.mmd_idempotency_uuid(text) to service_role;
grant execute on function public.cns_mmd_ingest(text, uuid, text, jsonb, jsonb) to service_role;
