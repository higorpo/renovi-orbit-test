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
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

insert into public.platform_constants (key, value)
values ('renovi_tax_provider', '0.15'::jsonb)
on conflict (key) do update set value = excluded.value;

create or replace function public.calculate_provider_service_pricing(
  p_original_amount numeric,
  p_tax_key text default 'renovi_tax_provider'
)
returns table (
  original_amount numeric,
  tax_rate numeric,
  tax_amount numeric,
  final_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_tax_value jsonb;
  v_tax_rate numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.role
  into v_user_role
  from public.profiles p
  where p.id = v_user_id;

  if v_user_role not in ('provider', 'admin') then
    raise exception 'Only providers and admins can calculate provider pricing';
  end if;

  if p_original_amount is null or p_original_amount <= 0 then
    raise exception 'Original amount must be greater than zero';
  end if;

  select pc.value
  into v_tax_value
  from public.platform_constants pc
  where pc.key = p_tax_key;

  if v_tax_value is null then
    raise exception 'Platform constant not found for key: %', p_tax_key;
  end if;

  if jsonb_typeof(v_tax_value) <> 'number' then
    raise exception 'Tax constant must be a numeric JSON value for key: %', p_tax_key;
  end if;

  v_tax_rate := (v_tax_value)::text::numeric;

  if v_tax_rate < 0 or v_tax_rate > 1 then
    raise exception 'Tax rate must be between 0 and 1';
  end if;

  original_amount := round(p_original_amount::numeric, 2);
  tax_rate := v_tax_rate;
  tax_amount := round((p_original_amount * v_tax_rate)::numeric, 2);
  final_amount := round((p_original_amount - (p_original_amount * v_tax_rate))::numeric, 2);

  return next;
end;
$$;

comment on function public.calculate_provider_service_pricing(numeric, text) is 'Calculates provider pricing using a dynamic tax constant key.';

revoke execute on function public.calculate_provider_service_pricing(numeric, text) from anon;
grant execute on function public.calculate_provider_service_pricing(numeric, text) to authenticated;
