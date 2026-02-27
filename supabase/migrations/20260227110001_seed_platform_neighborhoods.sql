-- Seed platform_neighborhoods so address form has options per city.
-- Admins can add more via dashboard or direct DB access.

insert into public.platform_neighborhoods (id, city_id, name, is_active)
values
  ('c3d4e5f6-a7b8-4901-c234-000000000001'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Centro', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000002'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Trindade', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000003'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Lagoa da Conceição', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000004'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Sé', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000005'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Pinheiros', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000006'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Vila Madalena', true)
on conflict (city_id, name) do nothing;
