-- Platform rate limits table for edge function rate limiting (e.g. generate-smart-description).
-- Used by _shared/rateLimiter.ts; if table is missing, functions fail open (allow).

create table if not exists public.platform_rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at bigint not null,
  burst_count int not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz
);

comment on table public.platform_rate_limits is 'Rate limit counters for edge functions (key = functionName:userIdOrIp).';

-- RLS: only edge functions (service role) can read/insert/update. No policies for anon/authenticated = no access.
alter table public.platform_rate_limits enable row level security;
