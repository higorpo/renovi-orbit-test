-- Platform forms table: stores dynamic form schemas for the request-quote flow.
-- Schema format is compatible with @/features/dynamic-form (version 2.0).

create table if not exists public.platform_forms (
  id uuid primary key default gen_random_uuid(),
  form_schema jsonb not null,
  form_version text not null default '2.0',
  form_status text not null default 'draft' check (form_status in ('draft', 'active', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  description text
);

comment on table public.platform_forms is 'Form definitions for service quote requests (dynamic-form schema v2).';
comment on column public.platform_forms.form_schema is 'JSON schema for DynamicForm (version 2.0).';
comment on column public.platform_forms.form_version is 'Schema version (e.g. 2.0).';
comment on column public.platform_forms.form_status is 'draft, active, or deprecated.';

-- RLS: public read for active forms; only admin can insert/update/delete (enforced by policy).
alter table public.platform_forms enable row level security;

-- Merged SELECT: active forms for anyone; all forms for admins.
create policy "Anyone can read active platform_forms or admins read all"
  on public.platform_forms for select
  using (
    form_status = 'active'
    or exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "Admins can insert platform_forms"
  on public.platform_forms for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "Admins can update platform_forms"
  on public.platform_forms for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );

create policy "Admins can delete platform_forms"
  on public.platform_forms for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
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

create trigger platform_forms_updated_at
  before update on public.platform_forms
  for each row execute procedure public.set_updated_at();
