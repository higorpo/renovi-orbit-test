-- Wave A — task 8: cross-domain RPC response idempotency cache (design §3.10, Req. 14).
-- Distinct from entity-scoped keys (e.g. chat_messages). Used by idempotency_begin/commit helpers.

create table public.rpc_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text,
  response_status int not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  constraint rpc_idempotency_actor_operation_key_unique unique (actor_user_id, operation, idempotency_key)
);

comment on table public.rpc_idempotency_records is
  'Cached mutation RPC responses for replay after client retry or PostgREST timeout. Reusable across features (CNS, payments, etc.).';

comment on column public.rpc_idempotency_records.operation is
  'Namespaced operation id (e.g. chats.accept_proposal, payments.create_charge).';

comment on column public.rpc_idempotency_records.request_hash is
  'Optional hash of request body; mismatch MAY reject replay with conflict.';

comment on column public.rpc_idempotency_records.response_body is
  'Serialized RPC result returned verbatim on duplicate (actor, operation, idempotency_key).';
