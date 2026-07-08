-- Include WORKFLOW_ACTION metadata in list_chat_messages payload projection
-- so reschedule cards can route and hydrate without a separate fetch.

create or replace function public.cns_project_message_payload_for_list(
  p_message_type public.cns_message_type,
  p_payload jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case p_message_type
    when 'TEXT'::public.cns_message_type then
      jsonb_build_object(
        'text',
        left(coalesce(nullif(trim(p_payload->>'text'), ''), ''), 4000)
      )
    when 'IMAGE'::public.cns_message_type then
      jsonb_strip_nulls(
        jsonb_build_object(
          'paths', p_payload->'paths',
          'preview',
            left(coalesce(nullif(trim(p_payload->>'preview'), ''), ''), 4000),
          'client_message_id', p_payload->'client_message_id'
        )
      )
    when 'AUDIO'::public.cns_message_type then
      jsonb_strip_nulls(
        jsonb_build_object(
          'path', nullif(trim(p_payload->>'path'), ''),
          'duration_ms', p_payload->'duration_ms',
          'mime_type',
            left(coalesce(nullif(trim(p_payload->>'mime_type'), ''), ''), 255),
          'preview',
            left(coalesce(nullif(trim(p_payload->>'preview'), ''), ''), 4000),
          'client_message_id', p_payload->'client_message_id'
        )
      )
    when 'PROPOSAL'::public.cns_message_type then
      jsonb_strip_nulls(
        jsonb_build_object(
          'client_message_id', p_payload->'client_message_id'
        )
      )
    when 'SYSTEM'::public.cns_message_type then
      jsonb_build_object(
        'text',
        left(coalesce(nullif(trim(p_payload->>'text'), ''), ''), 1000)
      )
    when 'WORKFLOW_ACTION'::public.cns_message_type then
      jsonb_strip_nulls(
        jsonb_build_object(
          'text',
            left(coalesce(nullif(trim(p_payload->>'text'), ''), ''), 1000),
          'action_key', nullif(trim(p_payload->>'action_key'), ''),
          'slot',
            case
              when jsonb_typeof(p_payload->'slot') = 'object' then
                jsonb_strip_nulls(
                  jsonb_build_object(
                    'start_date', p_payload->'slot'->'start_date',
                    'end_date', p_payload->'slot'->'end_date',
                    'shift', p_payload->'slot'->'shift'
                  )
                )
              else null
            end
        )
      )
    else '{}'::jsonb
  end;
$$;

comment on function public.cns_project_message_payload_for_list(public.cns_message_type, jsonb) is
  'List projection: omits heavy fields; includes WORKFLOW_ACTION action_key and slot for interactive cards.';
