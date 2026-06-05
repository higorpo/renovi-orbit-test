-- Add AUDIO message type for voice messages in chat (chat-media bucket).

alter type public.cns_message_type add value if not exists 'AUDIO';

comment on type public.cns_message_type is
  'chat_messages.content kind. AUDIO: voice message stored in chat-media bucket.';
