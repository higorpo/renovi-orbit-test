-- Service requests: quote requests created by clients.
-- Links client, service (or sub-service), optional address, and form data.

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
  city text,
  neighborhood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_requests is 'Quote requests from clients; one per request.';
comment on column public.service_requests.service_id is 'Service or sub-service selected.';
comment on column public.service_requests.address_id is 'Client address for the request; may be null if entered inline.';
comment on column public.service_requests.form_data is 'Dynamic form answers (from DynamicForm).';
comment on column public.service_requests.form_schema is 'Snapshot of the form schema used when the request was created (dynamic-form schema).';
comment on column public.service_requests.form_version is 'Schema version at creation time (e.g. 2.0).';
comment on column public.service_requests.photos is 'Array of photo URLs (e.g. storage public URLs).';

create index if not exists service_requests_client_id_idx on public.service_requests (client_id);
create index if not exists service_requests_service_id_idx on public.service_requests (service_id);
create index if not exists service_requests_status_idx on public.service_requests (status);

alter table public.service_requests enable row level security;

create policy "Clients can insert own service requests"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

create policy "Anyone can read service requests"
  on public.service_requests for select
  using (true);

create policy "Clients can update own service requests"
  on public.service_requests for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create trigger service_requests_updated_at
  before update on public.service_requests
  for each row execute procedure public.set_updated_at();
