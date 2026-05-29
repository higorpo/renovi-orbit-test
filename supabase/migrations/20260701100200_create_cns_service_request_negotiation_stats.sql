-- CNS Wave A — task 3: per-SR active chat admission counter (design §3.3, §3.3.1).
-- Depends on service_requests. Mutations only inside cns_* RPCs (not client DML).

create table public.service_request_negotiation_stats (
  service_request_id uuid primary key references public.service_requests (id) on delete cascade,
  active_chat_count int not null default 0 check (active_chat_count >= 0),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.service_request_negotiation_stats is
  'Admission counter for new ACTIVE chats per SR. Not a hard COUNT(*) invariant (design §3.3.1).';

comment on column public.service_request_negotiation_stats.active_chat_count is
  'Slots consumed for new-provider admission; compare to platform_constants chats.max_active_slots_per_service_request.';

comment on column public.service_request_negotiation_stats.version is
  'Optimistic bump on each counter update for debugging and future tooling.';

/*
 * §3.3.1 Slot accounting (normative) — active_chat_count deltas inside RPC transactions:
 *
 * | Transition                                      | Slot check before TX? | Delta      |
 * |-------------------------------------------------|----------------------|------------|
 * | New (service_request_id, provider_id) → ACTIVE  | Yes (reject if full) | +1         |
 * | INACTIVE → ACTIVE (reactivation message)        | No                   | 0          |
 * | ACTIVE → INACTIVE (reciprocity job)             | n/a                  | −1         |
 * | ACTIVE → CLOSED (manual / cascade)              | n/a                  | −1 if ACTIVE |
 * | Accept cascade (bulk close on SR)               | n/a                  | set 0      |
 *
 * Counter MAY under-count vs COUNT(*) WHERE status = ACTIVE when INACTIVE chats reactivate.
 * No reconciliation job required for v1.
 */

create trigger service_request_negotiation_stats_updated_at
  before update on public.service_request_negotiation_stats
  for each row execute procedure public.set_updated_at();
