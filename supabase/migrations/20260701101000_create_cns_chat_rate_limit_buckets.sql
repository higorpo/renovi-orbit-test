-- CNS Wave A — task 11: per-chat message rate limit buckets (design §3.14).
-- Limit read via platform_constant_int('chats.message_rate_limit_per_minute', 30) in cns_check_message_rate_limit.

create table public.chat_rate_limit_buckets (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  window_started_at timestamptz not null,
  message_count int not null default 1 check (message_count >= 1),
  primary key (chat_id, user_id, window_started_at)
);

comment on table public.chat_rate_limit_buckets is
  'Sliding-window send counters; cns_check_message_rate_limit INSERT ON CONFLICT increments before message insert.';

comment on column public.chat_rate_limit_buckets.window_started_at is
  'Start of the 1-minute bucket (truncate to minute in RPC).';

create index chat_rate_limit_buckets_window_started_idx
  on public.chat_rate_limit_buckets (window_started_at);

comment on index public.chat_rate_limit_buckets_window_started_idx is
  'Supports optional pruning of expired minute windows.';
