-- Platform constants: key-value settings used by pricing and other business rules.
create table if not exists public.platform_constants (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_constants is 'Key-value constants for platform business rules.';
comment on column public.platform_constants.key is 'Unique constant key.';
comment on column public.platform_constants.value is 'Generic constant value (string, number, boolean, object, array, or date as string).';

create trigger platform_constants_updated_at
  before update on public.platform_constants
  for each row execute procedure public.set_updated_at();

alter table public.platform_constants enable row level security;

create policy "Admins can manage platform constants"
  on public.platform_constants for all
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

insert into public.platform_constants (key, value)
values ('renovi_tax_provider', '0.15'::jsonb)
on conflict (key) do update set value = excluded.value;
