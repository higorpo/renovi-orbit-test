-- pgTAP: AUDIO payload projection for list_chat_messages.

begin;

select plan(2);

select is(
  public.cns_project_message_payload_for_list(
    'AUDIO'::public.cns_message_type,
    jsonb_build_object(
      'path', '018963cb-b1a1-4ba5-a170-9bf0efbe8bc6/da54bf9f-af14-47b9-b2cc-bfe59bfbba34/voice.webm',
      'duration_ms', 19413,
      'mime_type', 'audio/webm;codecs=opus',
      'preview', 'Áudio',
      'upload_session_id', 'da54bf9f-af14-47b9-b2cc-bfe59bfbba34'
    )
  ),
  jsonb_build_object(
    'path', '018963cb-b1a1-4ba5-a170-9bf0efbe8bc6/da54bf9f-af14-47b9-b2cc-bfe59bfbba34/voice.webm',
    'duration_ms', 19413,
    'mime_type', 'audio/webm;codecs=opus',
    'preview', 'Áudio'
  ),
  'AUDIO list projection keeps playback fields and omits upload_session_id'
);

select is(
  public.cns_project_message_payload_for_list(
    'AUDIO'::public.cns_message_type,
    jsonb_build_object(
      'path', '018963cb-b1a1-4ba5-a170-9bf0efbe8bc6/da54bf9f-af14-47b9-b2cc-bfe59bfbba34/voice.webm',
      'duration_ms', 19413
    )
  )->>'path',
  '018963cb-b1a1-4ba5-a170-9bf0efbe8bc6/da54bf9f-af14-47b9-b2cc-bfe59bfbba34/voice.webm',
  'AUDIO list projection preserves storage path'
);

select * from finish();

rollback;
