-- Notification triggers: enqueue MMD dispatches on row changes (replaces domain_events for notifications).

create or replace function public.trg_chat_messages_notify_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cns_notify_chat_message(new.id);
  return new;
end;
$$;

comment on function public.trg_chat_messages_notify_fn() is
  'AFTER INSERT on chat_messages: best-effort push for TEXT/IMAGE/AUDIO.';

drop trigger if exists trg_chat_messages_notify on public.chat_messages;

create trigger trg_chat_messages_notify
  after insert on public.chat_messages
  for each row
  when (new.message_type in (
    'TEXT'::public.cns_message_type,
    'IMAGE'::public.cns_message_type,
    'AUDIO'::public.cns_message_type
  ))
  execute function public.trg_chat_messages_notify_fn();

create or replace function public.trg_provider_proposals_submitted_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_proposal_submitted(new.id);
  return new;
end;
$$;

comment on function public.trg_provider_proposals_submitted_fn() is
  'AFTER INSERT on provider_proposals when status=PENDING.';

drop trigger if exists trg_provider_proposals_submitted on public.provider_proposals;

create trigger trg_provider_proposals_submitted
  after insert on public.provider_proposals
  for each row
  when (new.status = 'PENDING'::public.proposal_status)
  execute function public.trg_provider_proposals_submitted_fn();

drop trigger if exists trg_provider_proposals_status_notify on public.provider_proposals;

create trigger trg_provider_proposals_status_notify
  after update of status on public.provider_proposals
  for each row
  execute function public.notify_proposal_status_changed();

create or replace function public.trg_chats_manual_close_notify_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cns_notify_conversation_closed(new.id);
  return new;
end;
$$;

comment on function public.trg_chats_manual_close_notify_fn() is
  'AFTER UPDATE on chats: notify on manual close only (WHEN clause).';

drop trigger if exists trg_chats_manual_close_notify on public.chats;

create trigger trg_chats_manual_close_notify
  after update of status on public.chats
  for each row
  when (
    new.status = 'CLOSED'::public.cns_conversation_status
    and old.status is distinct from 'CLOSED'::public.cns_conversation_status
    and new.closure_type = 'MANUAL'::public.cns_closure_type
  )
  execute function public.trg_chats_manual_close_notify_fn();
