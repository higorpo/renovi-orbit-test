-- Provider private/legal data: entity type, CPF/CNPJ, legal name, etc.
-- Visible only to the provider and admin (read-only). Never exposed to clients or public.

create table if not exists public.provider_profiles_private (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  entity_type text not null default 'pf' check (entity_type in ('pf', 'pj')),
  cpf text,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  legal_representative_name text,
  legal_representative_cpf text,
  commercial_contact text,
  updated_at timestamptz not null default now()
);

comment on table public.provider_profiles_private is 'Sensitive provider/legal data; only owner and admin (read) can access.';
comment on column public.provider_profiles_private.entity_type is 'pf = pessoa física, pj = pessoa jurídica.';
comment on column public.provider_profiles_private.cpf is 'CPF when entity_type = pf.';
comment on column public.provider_profiles_private.cnpj is 'CNPJ when entity_type = pj.';
comment on column public.provider_profiles_private.razao_social is 'Legal company name when entity_type = pj.';
comment on column public.provider_profiles_private.nome_fantasia is 'Trade name when entity_type = pj.';
comment on column public.provider_profiles_private.legal_representative_name is 'Legal representative name for PJ.';
comment on column public.provider_profiles_private.legal_representative_cpf is 'Legal representative CPF for PJ.';
comment on column public.provider_profiles_private.commercial_contact is 'Optional commercial contact.';
comment on column public.provider_profiles_private.updated_at is 'Last update of private data.';

alter table public.provider_profiles_private enable row level security;

create policy "Providers can read own provider_profiles_private"
  on public.provider_profiles_private for select
  using (auth.uid() = provider_id);

create policy "Providers can update own provider_profiles_private"
  on public.provider_profiles_private for update
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

create policy "Providers can insert own provider_profiles_private"
  on public.provider_profiles_private for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles
      where profiles.id = provider_id and profiles.role = 'provider'
    )
  );

create policy "Admins can read provider_profiles_private"
  on public.provider_profiles_private for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create trigger provider_profiles_private_updated_at
  before update on public.provider_profiles_private
  for each row execute procedure public.set_updated_at();
