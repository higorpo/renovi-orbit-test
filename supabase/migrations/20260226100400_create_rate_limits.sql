-- Rate limits table for edge function rate limiting (e.g. generate-smart-description).
-- Used by _shared/rateLimiter.ts; if table is missing, functions fail open (allow).

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at bigint not null,
  burst_count int not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz
);

comment on table public.rate_limits is 'Rate limit counters for edge functions (key = functionName:userIdOrIp).';

-- RLS: only service role should access (edge functions use service role).
alter table public.rate_limits enable row level security;

-- No policies: table is intended for server-side use only (edge functions with service role bypass RLS).
-- If you need to allow anon/authenticated to read/write, add policies; by default only service role can access.
