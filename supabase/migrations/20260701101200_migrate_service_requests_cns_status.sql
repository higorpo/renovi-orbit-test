-- CNS task 13: evolve service_requests.status to service_request_status enum (design §3.16).
-- Dev-first: no production backfill or manual review queue; local seeds use legacy text values only.

alter table public.service_requests
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists contracted_service_id uuid references public.services (id);

comment on column public.service_requests.completed_at is
  'Set when status becomes COMPLETED (proposal accept cascade). Immutable after terminal transition.';

comment on column public.service_requests.cancelled_at is
  'Set when status becomes CANCELLED. Immutable after terminal transition.';

comment on column public.service_requests.contracted_service_id is
  'FK to contracted public.services row; MUST NOT duplicate accepted_proposal_id on SR (R15-AC04).';

alter table public.service_requests
  drop constraint if exists service_requests_status_check;

alter table public.service_requests
  alter column status drop default;

alter table public.service_requests
  alter column status type public.service_request_status
  using (
    case lower(status::text)
      when 'open' then 'OPEN'::public.service_request_status
      when 'in_progress' then 'OPEN'::public.service_request_status
      when 'cancelled' then 'CANCELLED'::public.service_request_status
      when 'closed' then 'OPEN'::public.service_request_status
      else 'OPEN'::public.service_request_status
    end
  );

alter table public.service_requests
  alter column status set default 'OPEN'::public.service_request_status;

comment on column public.service_requests.status is
  'SR lifecycle: OPEN, COMPLETED (accept), CANCELLED.';

-- Partial index for open jobs by geohash; recreate for enum OPEN.
drop index if exists public.idx_service_requests_status_geohash;

create index idx_service_requests_status_geohash
  on public.service_requests (status, geohash)
  where geohash is not null and status = 'OPEN'::public.service_request_status;

create or replace function public.reject_submitted_proposals_on_service_request_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'CANCELLED' then
    update public.provider_proposals
    set
      status = 'rejected',
      client_rejection_response = 'Proposta recusada automaticamente: pedido cancelado pelo cliente.'
    where service_request_id = new.id
      and status = 'submitted';
  end if;

  return new;
end;
$$;

comment on function public.reject_submitted_proposals_on_service_request_cancel() is
  'Rejects submitted provider proposals when service_requests.status becomes CANCELLED.';
