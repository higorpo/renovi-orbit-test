-- CNS Wave A — task 9: append-only status audit (design §3.11).
-- Triggers on chats/provider_proposals: task 20. Admin RLS: task 77.

create table public.chat_audit (
  id bigserial primary key,
  chat_id uuid not null,
  from_status public.cns_conversation_status,
  to_status public.cns_conversation_status not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.chat_audit is
  'Append-only chat FSM transitions; populated by trigger on chats.status (task 20).';

create index chat_audit_chat_created_idx
  on public.chat_audit (chat_id, created_at desc);

create table public.proposal_audit (
  id bigserial primary key,
  proposal_id uuid not null,
  from_status public.proposal_status,
  to_status public.proposal_status not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.proposal_audit is
  'Append-only proposal FSM transitions; populated by trigger on provider_proposals.status (task 20).';

create index proposal_audit_proposal_created_idx
  on public.proposal_audit (proposal_id, created_at desc);
