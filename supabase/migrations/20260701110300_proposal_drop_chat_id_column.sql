-- Drop chat_id from provider_proposals (plan migration 4)
drop index if exists public.provider_proposals_conversation_status_idx;
drop index if exists public.provider_proposals_one_pending_per_conversation;
alter table public.provider_proposals drop constraint if exists provider_proposals_chat_id_fkey;
alter table public.provider_proposals drop column if exists chat_id;
