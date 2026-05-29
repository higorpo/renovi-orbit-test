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

drop trigger if exists service_requests_reject_submitted_proposals_on_cancel on public.service_requests;

drop policy if exists "Clients providers and admins can read question response images" on storage.objects;

create or replace function public._migrate_legacy_service_request_status(p_status text)
returns public.service_request_status
language sql
immutable
as $$
  select case lower(btrim(p_status))
    when 'open' then 'OPEN'::public.service_request_status
    when 'in_progress' then 'OPEN'::public.service_request_status
    when 'cancelled' then 'CANCELLED'::public.service_request_status
    when 'closed' then 'OPEN'::public.service_request_status
    else 'OPEN'::public.service_request_status
  end;
$$;

-- Rename avoids PG ambiguity between column "status" and type service_request_status in USING.
alter table public.service_requests rename column status to legacy_status;

alter table public.service_requests
  add column status public.service_request_status not null default 'OPEN'::public.service_request_status;

update public.service_requests sr
set status = public._migrate_legacy_service_request_status(sr.legacy_status);

alter table public.service_requests drop column legacy_status;

drop function public._migrate_legacy_service_request_status(text);

comment on column public.service_requests.status is
  'SR lifecycle: OPEN, COMPLETED (accept), CANCELLED.';

-- Partial index for open jobs by geohash; recreate for enum OPEN.
drop index if exists public.idx_service_requests_status_geohash;
drop index if exists public.service_requests_status_idx;

create index service_requests_status_idx on public.service_requests (status);

create index idx_service_requests_status_geohash
  on public.service_requests (status, geohash)
  where geohash is not null and status = 'OPEN'::public.service_request_status;

create policy "Clients providers and admins can read question response images"
  on storage.objects for select
  using (
    bucket_id = 'client-question-responses'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1
        from public.provider_service_request_questions q
        join public.service_requests sr on sr.id = q.service_request_id
        where q.id::text = (storage.foldername(name))[5]
          and sr.id::text = (storage.foldername(name))[4]
          and q.provider_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.provider_service_request_questions q
        join public.service_requests sr on sr.id = q.service_request_id
        join public.profiles p on p.id = (select auth.uid())
        where q.id::text = (storage.foldername(name))[5]
          and sr.id::text = (storage.foldername(name))[4]
          and sr.status = 'OPEN'::public.service_request_status
          and q.client_response is not null
          and p.role = 'provider'
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'admin'
      )
    )
  );

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

create trigger service_requests_reject_submitted_proposals_on_cancel
  after update of status on public.service_requests
  for each row execute function public.reject_submitted_proposals_on_service_request_cancel();
