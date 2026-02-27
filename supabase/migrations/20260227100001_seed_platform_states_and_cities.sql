-- Seed platform_states and platform_cities with initial data so address form has options.
-- Admins can add more via dashboard or direct DB access.

insert into public.platform_states (id, ibge_code, name, abbreviation, is_active)
values
  ('a1b2c3d4-e5f6-4789-a012-000000000001'::uuid, 42, 'Santa Catarina', 'SC', true),
  ('a1b2c3d4-e5f6-4789-a012-000000000002'::uuid, 35, 'São Paulo', 'SP', true)
on conflict (ibge_code) do nothing;

insert into public.platform_cities (id, state_id, ibge_code, name, is_active)
values
  (
    'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid,
    'a1b2c3d4-e5f6-4789-a012-000000000001'::uuid,
    4205407,
    'Florianópolis',
    true
  ),
  (
    'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid,
    'a1b2c3d4-e5f6-4789-a012-000000000002'::uuid,
    3550308,
    'São Paulo',
    true
  )
on conflict (state_id, ibge_code) do nothing;
