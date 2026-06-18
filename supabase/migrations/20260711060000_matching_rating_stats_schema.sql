-- Matching M7 — service_ratings, provider stats tables, bootstrap + refresh triggers (design §3.6, ADR 0005).

create table public.service_ratings (
  id uuid primary key default gen_random_uuid(),
  contracted_service_id uuid not null references public.contracted_services (id) on delete cascade,
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  score_quality smallint not null check (score_quality between 1 and 5),
  score_punctuality smallint not null check (score_punctuality between 1 and 5),
  score_communication smallint not null check (score_communication between 1 and 5),
  score_value smallint not null check (score_value between 1 and 5),
  overall_score numeric(4, 2) not null,
  comment text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_ratings_contracted_service_unique unique (contracted_service_id)
);

comment on table public.service_ratings is
  'Client rating per contracted service; writes via submit/update_service_rating RPC only.';
comment on column public.service_ratings.overall_score is
  'Computed and persisted by rating RPCs from platform_constants dimension weights.';

create index service_ratings_provider_id_idx
  on public.service_ratings (provider_id);

create table public.provider_rating_stats (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  rating_count int not null default 0 check (rating_count >= 0),
  overall_avg numeric(4, 2),
  ranking_quality_score numeric(4, 2) not null default 5.0
    check (ranking_quality_score between 1 and 5),
  updated_at timestamptz not null default now()
);

comment on table public.provider_rating_stats is
  'Denormalized provider quality aggregates for ranking; refreshed by service_ratings trigger.';

create table public.provider_proposal_stats (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  resolved_count int not null default 0 check (resolved_count >= 0),
  accepted_count int not null default 0 check (accepted_count >= 0),
  ranking_conversion_score numeric(4, 4) not null default 0.5
    check (ranking_conversion_score between 0 and 1),
  updated_at timestamptz not null default now(),
  constraint provider_proposal_stats_accepted_lte_resolved check (
    accepted_count <= resolved_count
  )
);

comment on table public.provider_proposal_stats is
  'Denormalized proposal conversion aggregates for ranking; refreshed on terminal proposal transitions.';

create trigger service_ratings_updated_at
  before update on public.service_ratings
  for each row
  execute procedure public.set_updated_at();

create trigger provider_rating_stats_updated_at
  before update on public.provider_rating_stats
  for each row
  execute procedure public.set_updated_at();

create trigger provider_proposal_stats_updated_at
  before update on public.provider_proposal_stats
  for each row
  execute procedure public.set_updated_at();

create or replace function public.matching_refresh_provider_rating_stats(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_count int;
  v_rating_count int;
  v_overall_avg numeric(4, 2);
  v_ranking_quality numeric(4, 2);
begin
  v_min_count := public.platform_constant_int('matching.rating_min_count_for_ranking', 3);

  select
    count(*)::int,
    avg(sr.overall_score)::numeric(4, 2)
  into v_rating_count, v_overall_avg
  from public.service_ratings sr
  where sr.provider_id = p_provider_id;

  v_ranking_quality := case
    when v_rating_count < v_min_count then 5.0
    else coalesce(v_overall_avg, 5.0)
  end;

  insert into public.provider_rating_stats (
    provider_id,
    rating_count,
    overall_avg,
    ranking_quality_score,
    updated_at
  )
  values (
    p_provider_id,
    v_rating_count,
    v_overall_avg,
    v_ranking_quality,
    now()
  )
  on conflict (provider_id) do update set
    rating_count = excluded.rating_count,
    overall_avg = excluded.overall_avg,
    ranking_quality_score = excluded.ranking_quality_score,
    updated_at = now();
end;
$$;

comment on function public.matching_refresh_provider_rating_stats(uuid) is
  'Recomputes provider_rating_stats for one provider from service_ratings rows.';

create or replace function public.matching_refresh_provider_proposal_stats(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lookback_days int;
  v_min_resolved int;
  v_resolved_count int;
  v_accepted_count int;
  v_ranking_conversion numeric(4, 4);
begin
  v_lookback_days := public.platform_constant_int('matching.conversion_lookback_days', 90);
  v_min_resolved := public.platform_constant_int('matching.conversion_min_resolved_for_ranking', 3);

  select
    count(*)::int,
    count(*) filter (where pp.status = 'ACCEPTED'::public.proposal_status)::int
  into v_resolved_count, v_accepted_count
  from public.provider_proposals pp
  where pp.provider_id = p_provider_id
    and pp.status in (
      'ACCEPTED'::public.proposal_status,
      'REJECTED'::public.proposal_status,
      'REJECTED_AUTOMATICALLY'::public.proposal_status,
      'EXPIRED'::public.proposal_status
    )
    and pp.updated_at >= now() - (v_lookback_days || ' days')::interval;

  v_ranking_conversion := case
    when v_resolved_count < v_min_resolved then 0.5
    when v_resolved_count = 0 then 0.5
    else round((v_accepted_count::numeric / v_resolved_count::numeric), 4)
  end;

  insert into public.provider_proposal_stats (
    provider_id,
    resolved_count,
    accepted_count,
    ranking_conversion_score,
    updated_at
  )
  values (
    p_provider_id,
    v_resolved_count,
    v_accepted_count,
    v_ranking_conversion,
    now()
  )
  on conflict (provider_id) do update set
    resolved_count = excluded.resolved_count,
    accepted_count = excluded.accepted_count,
    ranking_conversion_score = excluded.ranking_conversion_score,
    updated_at = now();
end;
$$;

comment on function public.matching_refresh_provider_proposal_stats(uuid) is
  'Recomputes provider_proposal_stats from terminal proposals within conversion lookback window.';

revoke all on function public.matching_refresh_provider_rating_stats(uuid) from public;
revoke all on function public.matching_refresh_provider_proposal_stats(uuid) from public;

create or replace function public.trg_fn_profiles_bootstrap_provider_matching_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'provider' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.role is not distinct from 'provider' then
    return new;
  end if;

  insert into public.provider_rating_stats (
    provider_id,
    rating_count,
    overall_avg,
    ranking_quality_score
  )
  values (new.id, 0, null, 5.0)
  on conflict (provider_id) do nothing;

  insert into public.provider_proposal_stats (
    provider_id,
    resolved_count,
    accepted_count,
    ranking_conversion_score
  )
  values (new.id, 0, 0, 0.5)
  on conflict (provider_id) do nothing;

  return new;
end;
$$;

comment on function public.trg_fn_profiles_bootstrap_provider_matching_stats() is
  'Bootstraps provider_rating_stats and provider_proposal_stats when profiles.role becomes provider.';

revoke all on function public.trg_fn_profiles_bootstrap_provider_matching_stats() from public;

drop trigger if exists trg_profiles_bootstrap_provider_matching_stats on public.profiles;
create trigger trg_profiles_bootstrap_provider_matching_stats
  after insert or update of role on public.profiles
  for each row
  execute procedure public.trg_fn_profiles_bootstrap_provider_matching_stats();

create or replace function public.trg_fn_service_ratings_refresh_provider_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.matching_refresh_provider_rating_stats(old.provider_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.provider_id is distinct from new.provider_id then
    perform public.matching_refresh_provider_rating_stats(old.provider_id);
  end if;

  perform public.matching_refresh_provider_rating_stats(new.provider_id);
  return new;
end;
$$;

comment on function public.trg_fn_service_ratings_refresh_provider_rating_stats() is
  'AFTER INSERT/UPDATE/DELETE on service_ratings: refresh provider_rating_stats in same transaction.';

revoke all on function public.trg_fn_service_ratings_refresh_provider_rating_stats() from public;

drop trigger if exists trg_service_ratings_refresh_provider_rating_stats on public.service_ratings;
create trigger trg_service_ratings_refresh_provider_rating_stats
  after insert or update or delete on public.service_ratings
  for each row
  execute procedure public.trg_fn_service_ratings_refresh_provider_rating_stats();

create or replace function public.trg_fn_provider_proposals_refresh_proposal_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in (
    'ACCEPTED'::public.proposal_status,
    'REJECTED'::public.proposal_status,
    'REJECTED_AUTOMATICALLY'::public.proposal_status,
    'EXPIRED'::public.proposal_status
  ) then
    perform public.matching_refresh_provider_proposal_stats(new.provider_id);
  end if;

  return new;
end;
$$;

comment on function public.trg_fn_provider_proposals_refresh_proposal_stats() is
  'AFTER UPDATE on provider_proposals: refresh conversion stats on terminal status transition.';

revoke all on function public.trg_fn_provider_proposals_refresh_proposal_stats() from public;

drop trigger if exists trg_provider_proposals_refresh_proposal_stats on public.provider_proposals;
create trigger trg_provider_proposals_refresh_proposal_stats
  after update of status on public.provider_proposals
  for each row
  execute function public.trg_fn_provider_proposals_refresh_proposal_stats();

-- Bootstrap stats rows for providers that existed before matching stats triggers.
insert into public.provider_rating_stats (
  provider_id,
  rating_count,
  overall_avg,
  ranking_quality_score
)
select p.id, 0, null, 5.0
from public.profiles p
where p.role = 'provider'
on conflict (provider_id) do nothing;

insert into public.provider_proposal_stats (
  provider_id,
  resolved_count,
  accepted_count,
  ranking_conversion_score
)
select p.id, 0, 0, 0.5
from public.profiles p
where p.role = 'provider'
on conflict (provider_id) do nothing;

-- RLS
alter table public.service_ratings enable row level security;
alter table public.provider_rating_stats enable row level security;
alter table public.provider_proposal_stats enable row level security;

create policy service_ratings_select
  on public.service_ratings
  for select
  to authenticated
  using (
    (select auth.uid()) = client_id
    or (select auth.uid()) = provider_id
  );

create policy service_ratings_insert_denied
  on public.service_ratings
  for insert
  to authenticated
  with check (false);

create policy service_ratings_update_denied
  on public.service_ratings
  for update
  to authenticated
  using (false)
  with check (false);

create policy service_ratings_delete_denied
  on public.service_ratings
  for delete
  to authenticated
  using (false);

create policy provider_rating_stats_select
  on public.provider_rating_stats
  for select
  to anon, authenticated
  using (true);

create policy provider_proposal_stats_select_denied
  on public.provider_proposal_stats
  for select
  to authenticated
  using (false);

create policy provider_proposal_stats_insert_denied
  on public.provider_proposal_stats
  for insert
  to authenticated
  with check (false);

create policy provider_proposal_stats_update_denied
  on public.provider_proposal_stats
  for update
  to authenticated
  using (false)
  with check (false);

create policy provider_proposal_stats_delete_denied
  on public.provider_proposal_stats
  for delete
  to authenticated
  using (false);
