-- Load test seed: 15 clients × 10 service_requests = 150 requests across Florianópolis.
-- Run AFTER the main seed.sql (requires platform_states, platform_cities, forms, services).
--
-- All load-test accounts use password: Abc123
-- Emails: loadtest-01@prestway.com through loadtest-15@prestway.com
--
-- Usage (local):
--   1. Ensure main seed ran: supabase db reset
--   2. Apply this file: psql "$DATABASE_URL" -f supabase/seed-load-test.sql

-- =========================================================================
-- 1) Additional Florianópolis neighborhoods
-- =========================================================================
insert into public.platform_neighborhoods (id, city_id, name, is_active)
values
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Coqueiros',                true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b02'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Ingleses',                 true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Canasvieiras',             true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b04'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Campeche',                 true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b05'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Jurerê',                   true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b06'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Santo Antônio de Lisboa',  true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b07'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Itacorubi',                true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b08'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Córrego Grande',           true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b09'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Pantanal',                 true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b0a'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Saco dos Limões',          true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b0b'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Estreito',                 true)
on conflict (city_id, name) do nothing;

-- =========================================================================
-- 2) 15 test clients in auth.users
-- =========================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000001', 'authenticated', 'authenticated',
   'loadtest-01@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Ana Carolina Fernandes","role":"client"}'::jsonb,
   now() - interval '90 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000002', 'authenticated', 'authenticated',
   'loadtest-02@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Bruno Henrique Costa","role":"client"}'::jsonb,
   now() - interval '85 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000003', 'authenticated', 'authenticated',
   'loadtest-03@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Camila de Souza Oliveira","role":"client"}'::jsonb,
   now() - interval '80 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000004', 'authenticated', 'authenticated',
   'loadtest-04@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Daniel Augusto Almeida","role":"client"}'::jsonb,
   now() - interval '75 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000005', 'authenticated', 'authenticated',
   'loadtest-05@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Elena Rodrigues Pereira","role":"client"}'::jsonb,
   now() - interval '70 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000006', 'authenticated', 'authenticated',
   'loadtest-06@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Felipe Nascimento da Silva","role":"client"}'::jsonb,
   now() - interval '65 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000007', 'authenticated', 'authenticated',
   'loadtest-07@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Gabriela Santos Lima","role":"client"}'::jsonb,
   now() - interval '60 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000008', 'authenticated', 'authenticated',
   'loadtest-08@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Heitor Oliveira Neto","role":"client"}'::jsonb,
   now() - interval '55 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-000000000009', 'authenticated', 'authenticated',
   'loadtest-09@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Isabela Martins Rocha","role":"client"}'::jsonb,
   now() - interval '50 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000a', 'authenticated', 'authenticated',
   'loadtest-10@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"João Pedro Lima Ferreira","role":"client"}'::jsonb,
   now() - interval '45 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000b', 'authenticated', 'authenticated',
   'loadtest-11@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Karen Barbosa dos Santos","role":"client"}'::jsonb,
   now() - interval '40 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000c', 'authenticated', 'authenticated',
   'loadtest-12@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Lucas Pereira Cardoso","role":"client"}'::jsonb,
   now() - interval '35 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000d', 'authenticated', 'authenticated',
   'loadtest-13@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Mariana Vieira Ribeiro","role":"client"}'::jsonb,
   now() - interval '30 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000e', 'authenticated', 'authenticated',
   'loadtest-14@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Nicolas Andrade Moreira","role":"client"}'::jsonb,
   now() - interval '25 days', now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', '1a000001-0000-4000-a000-00000000000f', 'authenticated', 'authenticated',
   'loadtest-15@prestway.com', crypt('Abc123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Priscila Mendes Araújo","role":"client"}'::jsonb,
   now() - interval '20 days', now(), '', '', '', '')
on conflict (id) do nothing;

-- =========================================================================
-- 3) auth.identities (required for email/password login)
-- =========================================================================
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  ('1a000001-0000-4000-a000-000000000001', '1a000001-0000-4000-a000-000000000001',
   '{"sub":"1a000001-0000-4000-a000-000000000001","email":"loadtest-01@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000001', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000002', '1a000001-0000-4000-a000-000000000002',
   '{"sub":"1a000001-0000-4000-a000-000000000002","email":"loadtest-02@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000002', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000003', '1a000001-0000-4000-a000-000000000003',
   '{"sub":"1a000001-0000-4000-a000-000000000003","email":"loadtest-03@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000003', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000004', '1a000001-0000-4000-a000-000000000004',
   '{"sub":"1a000001-0000-4000-a000-000000000004","email":"loadtest-04@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000004', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000005', '1a000001-0000-4000-a000-000000000005',
   '{"sub":"1a000001-0000-4000-a000-000000000005","email":"loadtest-05@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000005', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000006', '1a000001-0000-4000-a000-000000000006',
   '{"sub":"1a000001-0000-4000-a000-000000000006","email":"loadtest-06@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000006', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000007', '1a000001-0000-4000-a000-000000000007',
   '{"sub":"1a000001-0000-4000-a000-000000000007","email":"loadtest-07@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000007', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000008', '1a000001-0000-4000-a000-000000000008',
   '{"sub":"1a000001-0000-4000-a000-000000000008","email":"loadtest-08@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000008', now(), now(), now()),
  ('1a000001-0000-4000-a000-000000000009', '1a000001-0000-4000-a000-000000000009',
   '{"sub":"1a000001-0000-4000-a000-000000000009","email":"loadtest-09@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-000000000009', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000a', '1a000001-0000-4000-a000-00000000000a',
   '{"sub":"1a000001-0000-4000-a000-00000000000a","email":"loadtest-10@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000a', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000b', '1a000001-0000-4000-a000-00000000000b',
   '{"sub":"1a000001-0000-4000-a000-00000000000b","email":"loadtest-11@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000b', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000c', '1a000001-0000-4000-a000-00000000000c',
   '{"sub":"1a000001-0000-4000-a000-00000000000c","email":"loadtest-12@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000c', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000d', '1a000001-0000-4000-a000-00000000000d',
   '{"sub":"1a000001-0000-4000-a000-00000000000d","email":"loadtest-13@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000d', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000e', '1a000001-0000-4000-a000-00000000000e',
   '{"sub":"1a000001-0000-4000-a000-00000000000e","email":"loadtest-14@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000e', now(), now(), now()),
  ('1a000001-0000-4000-a000-00000000000f', '1a000001-0000-4000-a000-00000000000f',
   '{"sub":"1a000001-0000-4000-a000-00000000000f","email":"loadtest-15@prestway.com"}'::jsonb, 'email', '1a000001-0000-4000-a000-00000000000f', now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- =========================================================================
-- 4) Update profiles with phone numbers (profiles auto-created by trigger)
-- =========================================================================
update public.profiles set phone = '(48) 99101-0001' where id = '1a000001-0000-4000-a000-000000000001' and phone is null;
update public.profiles set phone = '(48) 99102-0002' where id = '1a000001-0000-4000-a000-000000000002' and phone is null;
update public.profiles set phone = '(48) 99103-0003' where id = '1a000001-0000-4000-a000-000000000003' and phone is null;
update public.profiles set phone = '(48) 99104-0004' where id = '1a000001-0000-4000-a000-000000000004' and phone is null;
update public.profiles set phone = '(48) 99105-0005' where id = '1a000001-0000-4000-a000-000000000005' and phone is null;
update public.profiles set phone = '(48) 99106-0006' where id = '1a000001-0000-4000-a000-000000000006' and phone is null;
update public.profiles set phone = '(48) 99107-0007' where id = '1a000001-0000-4000-a000-000000000007' and phone is null;
update public.profiles set phone = '(48) 99108-0008' where id = '1a000001-0000-4000-a000-000000000008' and phone is null;
update public.profiles set phone = '(48) 99109-0009' where id = '1a000001-0000-4000-a000-000000000009' and phone is null;
update public.profiles set phone = '(48) 99110-0010' where id = '1a000001-0000-4000-a000-00000000000a' and phone is null;
update public.profiles set phone = '(48) 99111-0011' where id = '1a000001-0000-4000-a000-00000000000b' and phone is null;
update public.profiles set phone = '(48) 99112-0012' where id = '1a000001-0000-4000-a000-00000000000c' and phone is null;
update public.profiles set phone = '(48) 99113-0013' where id = '1a000001-0000-4000-a000-00000000000d' and phone is null;
update public.profiles set phone = '(48) 99114-0014' where id = '1a000001-0000-4000-a000-00000000000e' and phone is null;
update public.profiles set phone = '(48) 99115-0015' where id = '1a000001-0000-4000-a000-00000000000f' and phone is null;

-- =========================================================================
-- 5) client_addresses — 2 per client, different neighborhoods and coordinates
--    All in Florianópolis (SC).
--    state_id  = a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (SC)
--    city_id   = b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21  (Florianópolis)
-- =========================================================================
insert into public.client_addresses (
  id, client_id, label, street, number, complement,
  neighborhood, zip_code, state_id, city_id,
  is_default, is_active, location
)
values
  -- Client 01 — Centro / Coqueiros
  ('2a000001-0000-4000-a000-000000000001', '1a000001-0000-4000-a000-000000000001',
   'Casa', 'Rua Felipe Schmidt', '287', 'Apto 502',
   'Centro', '88010-000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5490, -27.5960), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000002', '1a000001-0000-4000-a000-000000000001',
   'Trabalho', 'Rua Desembargador Pedro Silva', '134', null,
   'Coqueiros', '88080-700', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5720, -27.5842), 4326)::geography),

  -- Client 02 — Trindade / Ingleses
  ('2a000001-0000-4000-a000-000000000003', '1a000001-0000-4000-a000-000000000002',
   'Casa', 'Rua Lauro Linhares', '1890', 'Bloco B Apto 201',
   'Trindade', '88036-002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5210, -27.5935), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000004', '1a000001-0000-4000-a000-000000000002',
   'Casa de praia', 'Rua das Gaivotas', '456', null,
   'Ingleses', '88058-100', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.3945, -27.4355), 4326)::geography),

  -- Client 03 — Lagoa da Conceição / Canasvieiras
  ('2a000001-0000-4000-a000-000000000005', '1a000001-0000-4000-a000-000000000003',
   'Casa', 'Rua Manuel de Araújo', '320', null,
   'Lagoa da Conceição', '88062-010', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.4660, -27.5998), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000006', '1a000001-0000-4000-a000-000000000003',
   'Apartamento', 'Rua Acari', '78', 'Apto 103',
   'Canasvieiras', '88054-150', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.4622, -27.4275), 4326)::geography),

  -- Client 04 — Agronômica / Campeche
  ('2a000001-0000-4000-a000-000000000007', '1a000001-0000-4000-a000-000000000004',
   'Casa', 'Rua Rui Barbosa', '610', 'Fundos',
   'Agronômica', '88025-301', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5395, -27.5838), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000008', '1a000001-0000-4000-a000-000000000004',
   'Casa de praia', 'Rua Pau de Canela', '215', null,
   'Campeche', '88063-515', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.4832, -27.6672), 4326)::geography),

  -- Client 05 — Itacorubi / Jurerê
  ('2a000001-0000-4000-a000-000000000009', '1a000001-0000-4000-a000-000000000005',
   'Casa', 'Rod. Admar Gonzaga', '1345', 'Sala 2',
   'Itacorubi', '88034-000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5058, -27.5788), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000000a', '1a000001-0000-4000-a000-000000000005',
   'Casa de veraneio', 'Alameda César Nascimento', '890', null,
   'Jurerê', '88053-500', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.4905, -27.4405), 4326)::geography),

  -- Client 06 — Córrego Grande / Santo Antônio de Lisboa
  ('2a000001-0000-4000-a000-00000000000b', '1a000001-0000-4000-a000-000000000006',
   'Apartamento', 'Rua João Pio Duarte Silva', '404', 'Apto 801',
   'Córrego Grande', '88037-000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5132, -27.5957), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000000c', '1a000001-0000-4000-a000-000000000006',
   'Casa', 'Caminho dos Açores', '1120', null,
   'Santo Antônio de Lisboa', '88050-300', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5242, -27.5097), 4326)::geography),

  -- Client 07 — Pantanal / Estreito
  ('2a000001-0000-4000-a000-00000000000d', '1a000001-0000-4000-a000-000000000007',
   'Casa', 'Rua Joe Collaço', '175', null,
   'Pantanal', '88040-400', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5182, -27.6058), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000000e', '1a000001-0000-4000-a000-000000000007',
   'Trabalho', 'Rua Santos Saraiva', '950', 'Sala 305',
   'Estreito', '88070-101', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5733, -27.5835), 4326)::geography),

  -- Client 08 — Saco dos Limões / Centro
  ('2a000001-0000-4000-a000-00000000000f', '1a000001-0000-4000-a000-000000000008',
   'Casa', 'Rua General Liberato Bittencourt', '520', null,
   'Saco dos Limões', '88045-010', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5315, -27.6155), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000010', '1a000001-0000-4000-a000-000000000008',
   'Escritório', 'Rua Conselheiro Mafra', '310', 'Sala 410',
   'Centro', '88010-102', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5475, -27.5948), 4326)::geography),

  -- Client 09 — Ingleses / Lagoa da Conceição
  ('2a000001-0000-4000-a000-000000000011', '1a000001-0000-4000-a000-000000000009',
   'Casa', 'Rua Dom João Becker', '1233', null,
   'Ingleses', '88058-600', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.3942, -27.4348), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000012', '1a000001-0000-4000-a000-000000000009',
   'Apartamento', 'Servidão do Porto', '89', 'Apto 202',
   'Lagoa da Conceição', '88062-200', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.4670, -27.6005), 4326)::geography),

  -- Client 10 — Canasvieiras / Agronômica
  ('2a000001-0000-4000-a000-000000000013', '1a000001-0000-4000-a000-00000000000a',
   'Casa', 'Rua Heitor Luz', '567', null,
   'Canasvieiras', '88054-500', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.4625, -27.4280), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000014', '1a000001-0000-4000-a000-00000000000a',
   'Apartamento', 'Rua Victor Konder', '240', 'Apto 601',
   'Agronômica', '88025-100', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5392, -27.5830), 4326)::geography),

  -- Client 11 — Campeche / Itacorubi
  ('2a000001-0000-4000-a000-000000000015', '1a000001-0000-4000-a000-00000000000b',
   'Casa', 'Rua da Capela', '310', null,
   'Campeche', '88063-100', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.4835, -27.6680), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000016', '1a000001-0000-4000-a000-00000000000b',
   'Escritório', 'Rua Amaro Antônio Vieira', '2015', 'Sala 102',
   'Itacorubi', '88034-101', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5060, -27.5790), 4326)::geography),

  -- Client 12 — Jurerê / Trindade
  ('2a000001-0000-4000-a000-000000000017', '1a000001-0000-4000-a000-00000000000c',
   'Casa de praia', 'Rua dos Búzios', '45', null,
   'Jurerê', '88053-600', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.4908, -27.4408), 4326)::geography),
  ('2a000001-0000-4000-a000-000000000018', '1a000001-0000-4000-a000-00000000000c',
   'Apartamento', 'Rua Delfino Conti', '780', 'Apto 303',
   'Trindade', '88040-370', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5208, -27.5940), 4326)::geography),

  -- Client 13 — Santo Antônio de Lisboa / Pantanal
  ('2a000001-0000-4000-a000-000000000019', '1a000001-0000-4000-a000-00000000000d',
   'Casa', 'Rua Padre Lourenço', '155', null,
   'Santo Antônio de Lisboa', '88050-400', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5240, -27.5095), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000001a', '1a000001-0000-4000-a000-00000000000d',
   'Apartamento', 'Rua Deputado Antônio Edu Vieira', '1305', 'Apto 704',
   'Pantanal', '88040-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5180, -27.6060), 4326)::geography),

  -- Client 14 — Estreito / Coqueiros
  ('2a000001-0000-4000-a000-00000000001b', '1a000001-0000-4000-a000-00000000000e',
   'Apartamento', 'Rua Fúlvio Aducci', '1680', 'Apto 902',
   'Estreito', '88075-000', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5730, -27.5832), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000001c', '1a000001-0000-4000-a000-00000000000e',
   'Casa', 'Rua General Valgas Neves', '88', null,
   'Coqueiros', '88080-350', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5718, -27.5840), 4326)::geography),

  -- Client 15 — Saco dos Limões / Córrego Grande
  ('2a000001-0000-4000-a000-00000000001d', '1a000001-0000-4000-a000-00000000000f',
   'Casa', 'Rua Koesa', '340', null,
   'Saco dos Limões', '88045-250', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   true, true, ST_SetSRID(ST_MakePoint(-48.5318, -27.6158), 4326)::geography),
  ('2a000001-0000-4000-a000-00000000001e', '1a000001-0000-4000-a000-00000000000f',
   'Apartamento', 'Rua Vera Linhares de Andrade', '625', 'Apto 404',
   'Córrego Grande', '88037-200', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
   false, true, ST_SetSRID(ST_MakePoint(-48.5130, -27.5955), 4326)::geography)
on conflict (id) do nothing;

-- =========================================================================
-- 6) 150 service_requests — 10 per client, diverse scenarios
--    Slot  1: Elétrica  — Instalação de tomadas
--    Slot  2: Elétrica  — Quadro / disjuntores
--    Slot  3: AC        — Instalação de split novo
--    Slot  4: Exemplo   — Reparo hidráulico
--    Slot  5: Elétrica  — Reforma / fiação
--    Slot  6: AC        — Limpeza / manutenção
--    Slot  7: Exemplo   — Instalação de acessório
--    Slot  8: Elétrica  — Iluminação
--    Slot  9: AC        — Troca de aparelho
--    Slot 10: Exemplo   — Pintura / impermeabilização
-- =========================================================================
DO $$
DECLARE
  v_cids uuid[] := ARRAY[
    '1a000001-0000-4000-a000-000000000001','1a000001-0000-4000-a000-000000000002',
    '1a000001-0000-4000-a000-000000000003','1a000001-0000-4000-a000-000000000004',
    '1a000001-0000-4000-a000-000000000005','1a000001-0000-4000-a000-000000000006',
    '1a000001-0000-4000-a000-000000000007','1a000001-0000-4000-a000-000000000008',
    '1a000001-0000-4000-a000-000000000009','1a000001-0000-4000-a000-00000000000a',
    '1a000001-0000-4000-a000-00000000000b','1a000001-0000-4000-a000-00000000000c',
    '1a000001-0000-4000-a000-00000000000d','1a000001-0000-4000-a000-00000000000e',
    '1a000001-0000-4000-a000-00000000000f'
  ];
  v_a1 uuid[] := ARRAY[
    '2a000001-0000-4000-a000-000000000001','2a000001-0000-4000-a000-000000000003',
    '2a000001-0000-4000-a000-000000000005','2a000001-0000-4000-a000-000000000007',
    '2a000001-0000-4000-a000-000000000009','2a000001-0000-4000-a000-00000000000b',
    '2a000001-0000-4000-a000-00000000000d','2a000001-0000-4000-a000-00000000000f',
    '2a000001-0000-4000-a000-000000000011','2a000001-0000-4000-a000-000000000013',
    '2a000001-0000-4000-a000-000000000015','2a000001-0000-4000-a000-000000000017',
    '2a000001-0000-4000-a000-000000000019','2a000001-0000-4000-a000-00000000001b',
    '2a000001-0000-4000-a000-00000000001d'
  ];
  v_a2 uuid[] := ARRAY[
    '2a000001-0000-4000-a000-000000000002','2a000001-0000-4000-a000-000000000004',
    '2a000001-0000-4000-a000-000000000006','2a000001-0000-4000-a000-000000000008',
    '2a000001-0000-4000-a000-00000000000a','2a000001-0000-4000-a000-00000000000c',
    '2a000001-0000-4000-a000-00000000000e','2a000001-0000-4000-a000-000000000010',
    '2a000001-0000-4000-a000-000000000012','2a000001-0000-4000-a000-000000000014',
    '2a000001-0000-4000-a000-000000000016','2a000001-0000-4000-a000-000000000018',
    '2a000001-0000-4000-a000-00000000001a','2a000001-0000-4000-a000-00000000001c',
    '2a000001-0000-4000-a000-00000000001e'
  ];

  v_svc_elet uuid := 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62';
  v_svc_ac   uuid := 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63';
  v_svc_ex   uuid := 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61';

  -- Parameterisation arrays (15 elements each, indexed by client)
  v_rooms text[] := ARRAY[
    'cozinha','sala de estar','quarto principal','escritório','varanda gourmet',
    'garagem','suíte master','sótão','copa','lavanderia',
    'sacada','área de serviço','sala de jantar','home office','cobertura'
  ];
  v_rooms2 text[] := ARRAY[
    'banheiro social','corredor','hall de entrada','closet','biblioteca',
    'sala de TV','despensa','estúdio','quarto de hóspedes','ateliê',
    'porão','sala comercial','recepção','mezanino','terraço'
  ];
  v_qtd int[] := ARRAY[3,5,8,4,6,10,7,12,9,15,2,11,6,4,8];
  v_btus text[] := ARRAY[
    '9000','12000','18000','12000','24000','9000','18000','30000','12000','24000',
    '9000','18000','12000','24000','9000'
  ];
  v_ac_qty int[] := ARRAY[1,2,3,1,2,1,3,4,2,1,2,3,1,2,1];
  v_urgencies text[] := ARRAY['low','medium','high'];
  v_complexities text[] := ARRAY['simple','medium','complex'];
  v_durations text[] := ARRAY[
    'under_1h','1_to_2h','2_to_4h','4_to_8h','1_day',
    '1_to_2_days','2_to_5_days','5_to_10_days','over_10_days','2_to_4h'
  ];

  i int;
  c uuid;
  a1 uuid;
  a2 uuid;
  v_urg text;
  v_cpx text;
  v_st text;
  v_ts timestamptz;
  v_photos text[];
  v_cid_str text;
BEGIN
  FOR i IN 1..15 LOOP
    c   := v_cids[i];
    a1  := v_a1[i];
    a2  := v_a2[i];
    v_cid_str := c::text;

    -- ── Slot 1: Elétrica — Instalação de tomadas ────────────────────────
    v_urg := v_urgencies[((i - 1) % 3) + 1];
    v_ts  := '2025-10-03'::timestamptz + (i * 3) * interval '1 day' + (i * 2) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000010_0.jpg', v_cid_str || '/1710000010_1.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_elet, a1,
      format('Instalação de %s tomadas na %s', v_qtd[i], v_rooms[i]),
      format('Preciso instalar %s pontos de tomada na %s. A fiação atual é antiga e não comporta a carga necessária. Gostaria de incluir aterramento e circuito independente para eletrodomésticos de alta potência.', v_qtd[i], v_rooms[i]),
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'nova', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_pontos', v_qtd[i], 'aterramento', true,
        'descricao', format('Instalação de %s tomadas na %s com aterramento', v_qtd[i], v_rooms[i])
      ),
      '2.0', 'open', v_urg, 'simple', '2_to_4h',
      ARRAY['tomada', 'instalação', 'residencial'],
      v_ts, v_ts
    );

    -- ── Slot 2: Elétrica — Quadro de distribuição / disjuntores ─────────
    v_urg := v_urgencies[((i) % 3) + 1];
    v_ts  := '2025-10-10'::timestamptz + (i * 4) * interval '1 day' + (i * 5) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000020_0.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_elet, a2,
      CASE (i % 3)
        WHEN 0 THEN 'Troca completa do quadro de distribuição'
        WHEN 1 THEN format('Substituição de %s disjuntores queimados', (i % 5) + 2)
        ELSE 'Instalação de disjuntor DR e DPS no quadro'
      END,
      CASE (i % 3)
        WHEN 0 THEN 'O quadro de distribuição atual é muito antigo e já apresentou sinais de superaquecimento. Preciso trocar por um quadro novo com barramento adequado e espaço para futuros circuitos.'
        WHEN 1 THEN format('Tenho %s disjuntores que estão desarmando com frequência e apresentam sinais de desgaste. Preciso da substituição urgente para evitar risco de incêndio.', (i % 5) + 2)
        ELSE 'Gostaria de instalar um disjuntor DR para proteção contra choque e um DPS para proteção contra surtos de energia. O quadro atual tem espaço disponível.'
      END,
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'manutencao', 'tipo_imovel', CASE WHEN i % 2 = 0 THEN 'comercial' ELSE 'residencial' END,
        'urgency', v_urg, 'qtd_pontos', (i % 5) + 2, 'aterramento', (i % 2 = 0),
        'descricao', 'Manutenção no quadro de distribuição'
      ),
      '2.0',
      CASE WHEN i <= 2 THEN 'in_progress' ELSE 'open' END,
      v_urg, 'medium', '4_to_8h',
      ARRAY['quadro elétrico', 'disjuntor', 'manutenção'],
      v_ts, v_ts
    );

    -- ── Slot 3: AC — Instalação de split novo ───────────────────────────
    v_urg := v_urgencies[((i + 1) % 3) + 1];
    v_ts  := '2025-10-18'::timestamptz + (i * 5) * interval '1 day' + (i * 3) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000030_0.jpg', v_cid_str || '/1710000030_1.jpg', v_cid_str || '/1710000030_2.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ac, a1,
      format('Instalação de %s split(s) %s BTU no %s', v_ac_qty[i], v_btus[i], v_rooms[i]),
      format('Preciso instalar %s aparelho(s) de ar condicionado split de %s BTU no %s. %s O pé-direito é de aproximadamente 2,80m.',
        v_ac_qty[i], v_btus[i], v_rooms[i],
        CASE WHEN i % 2 = 0 THEN 'Já existe ponto elétrico dedicado no local.' ELSE 'Não existe ponto elétrico no local, será necessário puxar um circuito novo.' END
      ),
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'instalacao_nova', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_aparelhos', v_ac_qty[i], 'capacidade_btu', v_btus[i],
        'ja_tem_ponto', (i % 2 = 0),
        'descricao', format('Instalação de %s split(s) %s BTU', v_ac_qty[i], v_btus[i])
      ),
      '2.0', 'open', v_urg,
      CASE WHEN v_ac_qty[i] >= 3 THEN 'complex' WHEN v_ac_qty[i] = 2 THEN 'medium' ELSE 'simple' END,
      CASE WHEN v_ac_qty[i] >= 3 THEN '1_day' WHEN v_ac_qty[i] = 2 THEN '4_to_8h' ELSE '2_to_4h' END,
      ARRAY['ar condicionado', 'split', 'instalação'],
      v_ts, v_ts
    );

    -- ── Slot 4: Exemplo — Reparo hidráulico ─────────────────────────────
    v_urg := v_urgencies[((i + 2) % 3) + 1];
    v_ts  := '2025-11-01'::timestamptz + (i * 3) * interval '1 day' + (i * 7) * interval '1 hour';

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ex, a2,
      CASE (i % 5)
        WHEN 0 THEN format('Reparo de vazamento no %s', v_rooms2[i])
        WHEN 1 THEN format('Troca de torneira e sifão na %s', v_rooms[i])
        WHEN 2 THEN 'Desentupimento de ralo e esgoto no banheiro'
        WHEN 3 THEN format('Conserto de descarga no %s', v_rooms2[i])
        ELSE format('Instalação de registro e misturador na %s', v_rooms[i])
      END,
      CASE (i % 5)
        WHEN 0 THEN format('Identifiquei um vazamento no %s que está causando infiltração na parede. A mancha de umidade tem aproximadamente 40cm de diâmetro e parece estar piorando.', v_rooms2[i])
        WHEN 1 THEN format('A torneira da %s está com vazamento constante e o sifão apresenta ferrugem. Preciso trocar ambas as peças. A pia é de granito com cuba de embutir.', v_rooms[i])
        WHEN 2 THEN 'O ralo do box do banheiro social está completamente entupido e a água não escoa. Já tentei usar desentupidor manual mas não resolveu. O problema começou há uma semana.'
        WHEN 3 THEN format('A válvula de descarga do %s não está funcionando corretamente — às vezes não completa o ciclo, às vezes fica correndo água continuamente.', v_rooms2[i])
        ELSE format('Quero instalar um registro de gaveta e um misturador novo na %s. O encanamento é de PVC e tem fácil acesso pela parede.', v_rooms[i])
      END,
      CASE WHEN i % 3 = 0 THEN ARRAY[v_cid_str || '/1710000040_0.jpg', v_cid_str || '/1710000040_1.jpg'] ELSE NULL END,
      jsonb_build_object(
        'tipo_servico', 'manutencao', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_pontos', 1, 'aterramento', false,
        'descricao', 'Reparo hidráulico'
      ),
      '2.0', 'open', v_urg, 'simple', 'under_1h',
      ARRAY['hidráulica', 'reparo', 'urgente'],
      v_ts, v_ts
    );

    -- ── Slot 5: Elétrica — Reforma / fiação ─────────────────────────────
    v_urg := v_urgencies[((i + 1) % 3) + 1];
    v_ts  := '2025-11-15'::timestamptz + (i * 2) * interval '1 day' + (i * 4) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000050_0.jpg', v_cid_str || '/1710000050_1.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_elet, a1,
      CASE (i % 4)
        WHEN 0 THEN format('Reforma elétrica completa da %s', v_rooms[i])
        WHEN 1 THEN format('Passagem de fiação nova para a %s', v_rooms2[i])
        WHEN 2 THEN 'Adequação elétrica para norma NBR 5410'
        ELSE format('Troca de toda a fiação antiga do %s', v_rooms[i])
      END,
      CASE (i % 4)
        WHEN 0 THEN format('Preciso de uma reforma elétrica completa na %s. A instalação tem mais de 20 anos, os fios estão ressecados e não há circuitos separados. Quero fiação nova, quadro novo e tomadas no padrão NBR.', v_rooms[i])
        WHEN 1 THEN format('Estou construindo uma %s nova e preciso de toda a passagem de fiação — pontos de tomada, iluminação e interruptores. A alvenaria já está pronta, falta a parte elétrica.', v_rooms2[i])
        WHEN 2 THEN 'Preciso adequar toda a instalação elétrica da casa à norma NBR 5410. Inclui instalação de DR, DPS, aterramento, separação de circuitos e identificação no quadro.'
        ELSE format('A fiação do %s é de alumínio e muito antiga. Preciso substituir toda por cobre, trocar as caixas de passagem e colocar conduletes novos. O imóvel é dos anos 80.', v_rooms[i])
      END,
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'reforma', 'tipo_imovel', CASE WHEN i % 3 = 0 THEN 'comercial' ELSE 'residencial' END,
        'urgency', v_urg, 'qtd_pontos', v_qtd[i] + 5, 'aterramento', true,
        'descricao', 'Reforma elétrica com troca de fiação e adequação à norma'
      ),
      '2.0',
      CASE WHEN i % 5 = 0 THEN 'in_progress' ELSE 'open' END,
      v_urg, 'complex', '2_to_5_days',
      ARRAY['reforma', 'fiação', 'NBR 5410'],
      v_ts, v_ts
    );

    -- ── Slot 6: AC — Limpeza e manutenção ───────────────────────────────
    v_urg := v_urgencies[((i) % 3) + 1];
    v_ts  := '2025-12-01'::timestamptz + (i * 3) * interval '1 day' + (i * 6) * interval '1 hour';

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ac, a2,
      CASE (i % 4)
        WHEN 0 THEN format('Limpeza e higienização de %s ar(es) condicionado(s)', v_ac_qty[i])
        WHEN 1 THEN 'Manutenção preventiva completa do split'
        WHEN 2 THEN format('Limpeza dos filtros e serpentina de %s aparelhos', v_ac_qty[i] + 1)
        ELSE 'Manutenção de ar condicionado com mau cheiro'
      END,
      CASE (i % 4)
        WHEN 0 THEN format('Preciso de limpeza completa e higienização de %s aparelho(s) de ar condicionado. Incluir limpeza de filtro, serpentina, bandeja de água e aplicação de bactericida. Último serviço foi há mais de 1 ano.', v_ac_qty[i])
        WHEN 1 THEN 'O ar condicionado split precisa de manutenção preventiva. Está fazendo um barulho estranho na unidade externa e não está gelando como antes. Marca: Samsung, modelo inverter.'
        WHEN 2 THEN format('Tenho %s aparelhos split que precisam de limpeza profunda. Nunca fizeram manutenção desde a instalação, há cerca de 2 anos. Todos são da mesma marca (LG).', v_ac_qty[i] + 1)
        ELSE 'O ar condicionado do quarto está com um cheiro forte de mofo quando liga. Já troquei o filtro por conta própria mas o cheiro persiste. Preciso de uma limpeza completa com higienização.'
      END,
      CASE WHEN i % 2 = 0 THEN ARRAY[v_cid_str || '/1710000060_0.jpg'] ELSE NULL END,
      jsonb_build_object(
        'tipo_servico', 'manutencao', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_aparelhos', v_ac_qty[i], 'capacidade_btu', v_btus[i],
        'ja_tem_ponto', true,
        'descricao', 'Limpeza e manutenção de ar condicionado',
        'horario_preferido', CASE WHEN i % 4 = 0 THEN 'manha' WHEN i % 4 = 1 THEN 'tarde' WHEN i % 4 = 2 THEN 'noite' ELSE 'flexivel' END
      ),
      '2.0',
      CASE WHEN i % 7 = 0 THEN 'closed' ELSE 'open' END,
      v_urg, 'simple', '1_to_2h',
      ARRAY['limpeza', 'manutenção', 'ar condicionado'],
      v_ts, v_ts
    );

    -- ── Slot 7: Exemplo — Instalação de acessório / móvel ───────────────
    v_urg := v_urgencies[((i + 2) % 3) + 1];
    v_ts  := '2025-12-15'::timestamptz + (i * 4) * interval '1 day' + (i * 1) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000070_0.jpg', v_cid_str || '/1710000070_1.jpg', v_cid_str || '/1710000070_2.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ex, a1,
      CASE (i % 5)
        WHEN 0 THEN 'Instalação de suporte articulado para TV 65 polegadas'
        WHEN 1 THEN format('Montagem de prateleiras flutuantes na %s', v_rooms[i])
        WHEN 2 THEN format('Instalação de varal de teto na %s', v_rooms2[i])
        WHEN 3 THEN 'Montagem de armário planejado no quarto'
        ELSE format('Instalação de cortineiro e persianas na %s', v_rooms[i])
      END,
      CASE (i % 5)
        WHEN 0 THEN 'Preciso instalar um suporte articulado para TV de 65 polegadas na parede da sala. A parede é de alvenaria. O suporte já foi comprado, preciso apenas da instalação com nível e parafusos adequados.'
        WHEN 1 THEN format('Gostaria de instalar 3 prateleiras flutuantes de MDF na %s, cada uma com 1,20m de comprimento. A parede é de drywall, então precisa de buchas especiais. Já tenho as prateleiras.', v_rooms[i])
        WHEN 2 THEN format('Preciso instalar um varal de teto retrátil na %s. O teto é de laje. O varal já foi comprado (modelo Secalux 1,20m). Preciso que fure e instale com os suportes adequados.', v_rooms2[i])
        WHEN 3 THEN 'Comprei um armário planejado que veio desmontado e preciso de alguém para montar. São 4 módulos (2 portas de correr + 2 gaveteiros). A montagem inclui fixação na parede.'
        ELSE format('Quero instalar um cortineiro de gesso na %s e colocar persianas rolô. A janela tem 2,40m de largura. Já comprei as persianas, preciso do cortineiro e da instalação completa.', v_rooms[i])
      END,
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'nova', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_pontos', 1, 'aterramento', false,
        'descricao', 'Instalação de acessório ou móvel'
      ),
      '2.0', 'open', v_urg, 'simple', '2_to_4h',
      ARRAY['montagem', 'instalação', 'residencial'],
      v_ts, v_ts
    );

    -- ── Slot 8: Elétrica — Iluminação ───────────────────────────────────
    v_urg := v_urgencies[((i + 1) % 3) + 1];
    v_ts  := '2026-01-05'::timestamptz + (i * 2) * interval '1 day' + (i * 8) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000080_0.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_elet, a2,
      CASE (i % 5)
        WHEN 0 THEN format('Instalação de %s spots de LED embutidos na %s', v_qtd[i], v_rooms[i])
        WHEN 1 THEN format('Instalação de fita LED e dimmer na %s', v_rooms2[i])
        WHEN 2 THEN format('Troca de %s luminárias fluorescentes por LED', v_qtd[i])
        WHEN 3 THEN format('Instalação de interruptores inteligentes Wi-Fi na %s', v_rooms[i])
        ELSE format('Instalação de iluminação externa na %s', v_rooms2[i])
      END,
      CASE (i % 5)
        WHEN 0 THEN format('Quero instalar %s spots de LED embutidos no forro de gesso da %s. Preciso de furação no gesso, passagem de fio e conexão ao interruptor existente. Prefiro LED branco frio.', v_qtd[i], v_rooms[i])
        WHEN 1 THEN format('Gostaria de instalar fita de LED RGB com dimmer na %s para iluminação indireta. O forro tem sanca aberta. Preciso de fonte, controlador e instalação completa.', v_rooms2[i])
        WHEN 2 THEN format('Preciso trocar %s luminárias fluorescentes tubulares por painéis LED de sobrepor. As luminárias atuais são de 2x40W e estão fixadas em forro de PVC.', v_qtd[i])
        WHEN 3 THEN format('Quero substituir os interruptores tradicionais da %s por modelos inteligentes Wi-Fi (já comprei os interruptores Sonoff). Preciso de instalação com fio neutro.', v_rooms[i])
        ELSE format('Preciso de iluminação externa na %s — arandelas na fachada e spots no jardim. Total de 6 pontos. A fiação precisa ser embutida em eletroduto aparente.', v_rooms2[i])
      END,
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'nova', 'tipo_imovel', CASE WHEN i % 3 = 2 THEN 'comercial' ELSE 'residencial' END,
        'urgency', v_urg, 'qtd_pontos', v_qtd[i], 'aterramento', false,
        'descricao', format('Instalação de iluminação na %s', v_rooms[i])
      ),
      '2.0',
      CASE WHEN i % 4 = 0 THEN 'in_progress' ELSE 'open' END,
      v_urg, 'medium', '4_to_8h',
      ARRAY['iluminação', 'LED', 'instalação'],
      v_ts, v_ts
    );

    -- ── Slot 9: AC — Troca de aparelho ──────────────────────────────────
    v_urg := v_urgencies[((i) % 3) + 1];
    v_ts  := '2026-01-20'::timestamptz + (i * 5) * interval '1 day' + (i * 2) * interval '1 hour';

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ac, a1,
      CASE (i % 4)
        WHEN 0 THEN format('Troca de ar de janela por split %s BTU', v_btus[i])
        WHEN 1 THEN format('Desinstalação e reinstalação de split por mudança')
        WHEN 2 THEN format('Troca de split com defeito no compressor — %s BTU', v_btus[i])
        ELSE format('Substituição de aparelho antigo por inverter %s BTU', v_btus[i])
      END,
      CASE (i % 4)
        WHEN 0 THEN format('Quero trocar um ar condicionado de janela antigo por um split %s BTU. Preciso da desinstalação do aparelho de janela, fechamento do vão e instalação completa do split com tubulação nova.', v_btus[i])
        WHEN 1 THEN 'Estou me mudando e preciso desinstalar um split do apartamento atual e reinstalar no novo endereço. O aparelho é um Samsung 12.000 BTU inverter. Distância da mudança: 5km.'
        WHEN 2 THEN format('Meu split de %s BTU parou de funcionar — técnico diagnosticou problema no compressor. Já comprei um aparelho novo da mesma capacidade e preciso da troca: desinstalar o antigo e instalar o novo.', v_btus[i])
        ELSE format('Quero substituir meu ar condicionado convencional por um modelo inverter de %s BTU. O aparelho novo já foi comprado. Preciso da desinstalação do antigo e instalação do novo usando a tubulação existente, se possível.', v_btus[i])
      END,
      CASE WHEN i % 3 = 0 THEN ARRAY[v_cid_str || '/1710000090_0.jpg', v_cid_str || '/1710000090_1.jpg'] ELSE NULL END,
      jsonb_build_object(
        'tipo_servico', 'troca', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_aparelhos', 1, 'capacidade_btu', v_btus[i],
        'ja_tem_ponto', true,
        'descricao', format('Troca de aparelho de ar condicionado %s BTU', v_btus[i]),
        'horario_preferido', CASE WHEN i % 3 = 0 THEN 'manha' WHEN i % 3 = 1 THEN 'tarde' ELSE 'flexivel' END
      ),
      '2.0',
      CASE WHEN i % 6 = 0 THEN 'closed' WHEN i % 8 = 0 THEN 'cancelled' ELSE 'open' END,
      v_urg, 'medium', '2_to_4h',
      ARRAY['troca', 'ar condicionado', 'split'],
      v_ts, v_ts
    );

    -- ── Slot 10: Exemplo — Pintura / impermeabilização / reforma ────────
    v_urg := v_urgencies[((i + 2) % 3) + 1];
    v_ts  := '2026-02-05'::timestamptz + (i * 3) * interval '1 day' + (i * 9) * interval '1 hour';
    v_photos := ARRAY[v_cid_str || '/1710000100_0.jpg', v_cid_str || '/1710000100_1.jpg', v_cid_str || '/1710000100_2.jpg'];

    INSERT INTO public.service_requests (
      client_id, service_id, address_id, title, description,
      photos, form_data, form_version, status, urgency,
      scope_complexity, estimated_duration_hint, tags, created_at, updated_at
    ) VALUES (
      c, v_svc_ex, a2,
      CASE (i % 5)
        WHEN 0 THEN format('Pintura completa da %s e %s', v_rooms[i], v_rooms2[i])
        WHEN 1 THEN 'Impermeabilização de laje da cobertura'
        WHEN 2 THEN format('Reparo em telhado com goteira na %s', v_rooms[i])
        WHEN 3 THEN format('Textura e pintura das paredes do %s', v_rooms2[i])
        ELSE format('Aplicação de grafiato na fachada e pintura da %s', v_rooms[i])
      END,
      CASE (i % 5)
        WHEN 0 THEN format('Preciso de pintura completa da %s e %s — paredes e teto. A área total é de aproximadamente 45m². As paredes precisam de lixamento e uma demão de massa corrida antes da pintura. Prefiro tinta acrílica acetinada.', v_rooms[i], v_rooms2[i])
        WHEN 1 THEN 'A laje da cobertura está com infiltração e preciso de impermeabilização completa. A área é de aproximadamente 80m². Já descasquei a tinta antiga. Preciso de manta asfáltica ou produto similar com garantia.'
        WHEN 2 THEN format('Tenho uma goteira na %s que aparece sempre que chove forte. Suspeito que seja uma telha quebrada ou deslocada. O telhado é de telha portuguesa e tem acesso fácil pelo sótão.', v_rooms[i])
        WHEN 3 THEN format('Quero aplicar textura nas paredes do %s e depois pintar com cor a definir. A área é de aproximadamente 30m². As paredes estão com a massa corrida antiga e precisam de preparação.', v_rooms2[i])
        ELSE format('Gostaria de aplicar grafiato na fachada frontal da casa e pintar a %s. A fachada tem aproximadamente 25m² e a %s cerca de 20m². Prefiro grafiato riscado.', v_rooms[i], v_rooms[i])
      END,
      v_photos,
      jsonb_build_object(
        'tipo_servico', 'reforma', 'tipo_imovel', 'residencial', 'urgency', v_urg,
        'qtd_pontos', 1, 'aterramento', false,
        'descricao', 'Pintura, textura ou impermeabilização'
      ),
      '2.0',
      CASE WHEN i % 10 = 0 THEN 'cancelled' WHEN i % 5 = 0 THEN 'closed' ELSE 'open' END,
      v_urg, 'complex', '2_to_5_days',
      ARRAY['pintura', 'reforma', 'impermeabilização'],
      v_ts, v_ts
    );

  END LOOP;

  RAISE NOTICE 'Load test seed complete: 15 clients, 30 addresses, 150 service requests.';
END;
$$;
