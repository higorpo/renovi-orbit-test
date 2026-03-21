-- Service requests: quote requests created by clients.
-- Links client, service (or sub-service), optional address, and form data.
-- City/neighborhood come from address_id -> client_addresses. Location/geohash are synced from client_addresses for list-by-region queries.

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  address_id uuid references public.client_addresses (id) on delete set null,
  title text not null,
  description text,
  photos text[],
  form_data jsonb,
  form_schema jsonb,
  form_version text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  urgency text check (urgency is null or urgency in ('low', 'medium', 'high')),
  scope_complexity text check (scope_complexity is null or scope_complexity in ('simple', 'medium', 'complex')),
  suggested_questions text[],
  tags text[],
  missing_info_warnings text[],
  suggested_equipment text[],
  suggested_materials text[],
  estimated_duration_hint text check (
    estimated_duration_hint is null
    or estimated_duration_hint in (
      'under_1h', '1_to_2h', '2_to_4h', '4_to_8h',
      '1_day', '1_to_2_days', '2_to_5_days', '5_to_10_days', 'over_10_days'
    )
  ),
  -- Snapshot of address coordinates at request creation; synced from client_addresses when address_id is set (trigger).
  location geography(Point, 4326),
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  geohash text generated always as (st_geohash(location::geometry, 7)) stored,
  h3_index text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_requests is 'Quote requests from clients; one per request.';
comment on column public.service_requests.service_id is 'Service or sub-service selected.';
comment on column public.service_requests.address_id is 'Client address for the request; may be null if entered inline.';
comment on column public.service_requests.form_data is 'Dynamic form answers (from DynamicForm).';
comment on column public.service_requests.form_schema is 'Snapshot of the form schema used when the request was created (dynamic-form schema).';
comment on column public.service_requests.form_version is 'Schema version at creation time (e.g. 2.0).';
comment on column public.service_requests.photos is 'Array of storage paths (e.g. userId/timestamp_index.ext) for private bucket; use signed URLs to display.';
comment on column public.service_requests.urgency is 'AI-derived urgency: low, medium, high.';
comment on column public.service_requests.scope_complexity is 'AI-derived scope complexity: simple, medium, complex.';
comment on column public.service_requests.suggested_questions is 'AI-suggested follow-up questions for the client.';
comment on column public.service_requests.tags is 'AI-derived tags for the request.';
comment on column public.service_requests.missing_info_warnings is 'AI warnings about missing or unclear information.';
comment on column public.service_requests.suggested_equipment is 'AI-suggested equipment/tools keys (snake_case, from allowed list) the professional may need.';
comment on column public.service_requests.suggested_materials is 'AI-suggested materials/consumables keys (snake_case, from allowed list) typically needed for the job.';
comment on column public.service_requests.estimated_duration_hint is 'AI-derived estimated duration key: under_1h, 1_to_2h, 2_to_4h, 4_to_8h, 1_day, 1_to_2_days, 2_to_5_days, 5_to_10_days, over_10_days.';
comment on column public.service_requests.location is 'Snapshot of address coordinates at request creation; synced from client_addresses when address_id is set. Used for region/geohash queries.';
comment on column public.service_requests.latitude is 'WGS84 latitude derived from location.';
comment on column public.service_requests.longitude is 'WGS84 longitude derived from location.';
comment on column public.service_requests.geohash is 'Geohash (precision 7) derived from location for list-by-region queries.';
comment on column public.service_requests.h3_index is 'H3 cell index synced from client_addresses when address_id is set; used for spatial indexing and match-provider-jobs.';

create index if not exists service_requests_client_id_idx on public.service_requests (client_id);
create index if not exists service_requests_service_id_idx on public.service_requests (service_id);
create index if not exists service_requests_status_idx on public.service_requests (status);
create index if not exists idx_service_requests_location on public.service_requests using gist (location) where location is not null;
create index if not exists idx_service_requests_geohash on public.service_requests (geohash) where geohash is not null;
create index if not exists idx_service_requests_status_geohash on public.service_requests (status, geohash) where geohash is not null and status = 'open';
create index if not exists idx_service_requests_h3_index on public.service_requests (h3_index) where h3_index is not null;

-- Sync location and h3_index from client_addresses when address_id is set (insert or update).
create or replace function public.sync_service_request_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.address_id is not null then
    select ca.location, ca.h3_index into new.location, new.h3_index
    from public.client_addresses ca
    where ca.id = new.address_id;
  else
    new.location := null;
    new.h3_index := null;
  end if;
  return new;
end;
$$;

comment on function public.sync_service_request_location() is 'Copies client_addresses.location and h3_index into service_requests when address_id is set.';

create trigger service_requests_sync_location
  before insert or update of address_id on public.service_requests
  for each row execute function public.sync_service_request_location();

alter table public.service_requests enable row level security;

create policy "Clients can insert own service requests"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

create policy "Clients read own; providers and admins read all"
  on public.service_requests for select
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'provider'))
  );

create policy "Clients can update own service requests; admins can update any"
  on public.service_requests for update
  using (
    auth.uid() = client_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = client_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger service_requests_updated_at
  before update on public.service_requests
  for each row execute procedure public.set_updated_at();

-- Questions sent by providers to clients for a specific service request.
create table if not exists public.provider_service_request_questions (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) > 0 and char_length(trim(question)) <= 1000),
  client_response text,
  client_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.provider_service_request_questions is 'Questions that providers ask clients about a specific service request.';
comment on column public.provider_service_request_questions.service_request_id is 'Target service request.';
comment on column public.provider_service_request_questions.provider_id is 'Provider who asked the question.';
comment on column public.provider_service_request_questions.question is 'Provider question text (max 1000 chars).';
comment on column public.provider_service_request_questions.client_response is 'Client response text; null until client responds.';
comment on column public.provider_service_request_questions.client_responded_at is 'Timestamp of client response.';

create index if not exists provider_sr_questions_service_request_idx
  on public.provider_service_request_questions (service_request_id, created_at desc);
create index if not exists provider_sr_questions_provider_idx
  on public.provider_service_request_questions (provider_id, created_at desc);
create index if not exists provider_sr_questions_service_request_provider_idx
  on public.provider_service_request_questions (service_request_id, provider_id);

alter table public.provider_service_request_questions enable row level security;

create policy "Providers can insert own service request questions"
  on public.provider_service_request_questions for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'provider'
    )
  );

create policy "Providers can read own questions; clients read own requests; admins read all"
  on public.provider_service_request_questions for select
  using (
    auth.uid() = provider_id
    or exists (
      select 1
      from public.service_requests sr
      where sr.id = service_request_id
        and sr.client_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create trigger provider_service_request_questions_updated_at
  before update on public.provider_service_request_questions
  for each row execute procedure public.set_updated_at();

create or replace function public.list_provider_service_request_questions(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_role text;
  v_can_view boolean;
  v_result jsonb;
begin
  v_provider_id := auth.uid();
  if v_provider_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_provider_id;

  if v_role <> 'provider' then
    raise exception 'Only providers can view service request questions';
  end if;

  if p_service_request_id is null then
    raise exception 'Service request is required';
  end if;

  select exists (
    select 1
    from public.service_requests sr
    where sr.id = p_service_request_id
      and sr.status = 'open'
  )
  into v_can_view;

  if not v_can_view then
    raise exception 'Forbidden';
  end if;

  with own_questions as (
    select
      q.id,
      q.question,
      q.client_response,
      q.created_at,
      q.client_responded_at,
      true as is_own_question,
      null::text as provider_first_name
    from public.provider_service_request_questions q
    where q.service_request_id = p_service_request_id
      and q.provider_id = v_provider_id
  ),
  answered_other_questions as (
    select
      q.id,
      q.question,
      q.client_response,
      q.created_at,
      q.client_responded_at,
      false as is_own_question,
      split_part(coalesce(p.full_name, ''), ' ', 1) as provider_first_name
    from public.provider_service_request_questions q
    join public.profiles p on p.id = q.provider_id
    where q.service_request_id = p_service_request_id
      and q.provider_id <> v_provider_id
      and q.client_response is not null
  ),
  visible_questions as (
    select * from own_questions
    union all
    select * from answered_other_questions
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', vq.id,
        'question', vq.question,
        'client_response', vq.client_response,
        'created_at', vq.created_at,
        'client_responded_at', vq.client_responded_at,
        'is_own_question', vq.is_own_question,
        'provider_first_name', vq.provider_first_name
      )
      order by vq.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from visible_questions vq;

  return v_result;
end;
$$;

comment on function public.list_provider_service_request_questions is 'Lists questions for an open service request to authenticated providers: includes all own questions and other providers questions only when client response exists.';

revoke execute on function public.list_provider_service_request_questions(uuid) from anon;
grant execute on function public.list_provider_service_request_questions(uuid) to authenticated;
