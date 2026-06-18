-- Matching M14f — document cns_initiate_conversation has no DISPATCH_STOPPED gate (design §15.7, #88).

comment on function public.cns_initiate_conversation(uuid, uuid) is
  'Provider chat initiation; admission uses CNS active_chat_count vs chats.max_active_slots_per_service_request only — intentionally NO DISPATCH_STOPPED check (matching #88).';
