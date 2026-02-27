-- Forms table: stores dynamic form schemas for the request-quote flow.
-- Schema format is compatible with @/features/dynamic-form (version 2.0).

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  form_schema jsonb not null,
  form_version text not null default '2.0',
  form_status text not null default 'draft' check (form_status in ('draft', 'active', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  description text
);

comment on table public.forms is 'Form definitions for service quote requests (dynamic-form schema v2).';
comment on column public.forms.form_schema is 'JSON schema for DynamicForm (version 2.0).';
comment on column public.forms.form_version is 'Schema version (e.g. 2.0).';
comment on column public.forms.form_status is 'draft, active, or deprecated.';

-- RLS: public read for active forms; only admin can insert/update/delete (enforced by policy).
alter table public.forms enable row level security;

-- Anyone can read active forms (needed for request-quote page).
create policy "Anyone can read active forms"
  on public.forms for select
  using (form_status = 'active');

-- Admins can read all forms and manage (insert/update/delete).
create policy "Admins can manage forms"
  on public.forms for all
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

-- Trigger to keep updated_at in sync.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger forms_updated_at
  before update on public.forms
  for each row execute procedure public.set_updated_at();
