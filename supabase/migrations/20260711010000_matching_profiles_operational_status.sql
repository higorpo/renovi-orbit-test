-- Matching M2 — profiles.operational_status enum + column (design §3.1 M2, requirements §Persistence Model).

create type public.provider_operational_status as enum ('active', 'suspended');

comment on type public.provider_operational_status is
  'Provider matching eligibility: active participates in dispatch; suspended executes contracted work only.';

alter table public.profiles
  add column operational_status public.provider_operational_status not null default 'active';

comment on column public.profiles.operational_status is
  'Matching eligibility. Default active. Admin change mechanism out of MVP (#52).';

create or replace function public.profiles_block_operational_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.operational_status is distinct from old.operational_status then
    if current_user in ('postgres', 'supabase_admin') then
      return new;
    end if;

    if coalesce((select auth.jwt()) ->> 'role', '') = 'service_role' then
      return new;
    end if;

    raise exception 'operational_status cannot be changed via application; admin tooling required.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.profiles_block_operational_status_update() is
  'Blocks authenticated users from changing operational_status; service_role and migrations may update.';

drop trigger if exists profiles_block_operational_status_update_trigger on public.profiles;
create trigger profiles_block_operational_status_update_trigger
  before update of operational_status on public.profiles
  for each row
  execute procedure public.profiles_block_operational_status_update();
