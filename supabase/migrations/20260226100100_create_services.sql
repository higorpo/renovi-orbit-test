-- Services table: services and sub-services for request-quote.
-- parent_id is null for top-level services; set for sub-services (e.g. "Instalação elétrica de ar condicionado" under "Instalação elétrica").

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.services (id) on delete set null,
  form_id uuid references public.forms (id) on delete set null,
  title text not null,
  description text,
  image_url text,
  slug text not null,
  show_on_request_quote boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_slug_unique unique (slug)
);

comment on table public.services is 'Services and sub-services for quote requests; only admin can modify.';
comment on column public.services.parent_id is 'Parent service for sub-services; null for top-level.';
comment on column public.services.form_id is 'Form used for this service quote (dynamic-form schema).';
comment on column public.services.show_on_request_quote is 'When true, service is listed on request-quote page.';
comment on column public.services.active is 'When false, service is hidden from public read (RLS). When true, anyone can read.';
comment on column public.services.sort_order is 'Display order on request-quote page (lower first).';

-- Indexes:
-- - parent_id: used for FK and for queries that filter by parent (e.g. top-level only or children of X).
--   Current app loads all rows and builds tree in memory, so this is optional but useful if queries change.
-- - slug: NOT indexed here — unique(slug) already creates a unique index; extra index would be redundant.
-- - active + sort_order: one partial index for the main list query (WHERE active = true ORDER BY sort_order).
--   show_on_request_quote index removed: RLS uses active; one partial index is enough for list + order.
create index if not exists services_parent_id_idx on public.services (parent_id);
create index if not exists services_active_sort_idx on public.services (active, sort_order) where active = true;

-- RLS: public can read services where active = true; only admin can insert/update/delete.
alter table public.services enable row level security;

create policy "Public can read active services"
  on public.services for select
  using (active = true);

create policy "Admins have full access to services"
  on public.services for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create trigger services_updated_at
  before update on public.services
  for each row execute procedure public.set_updated_at();
