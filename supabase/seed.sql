-- Seed data for local development and db reset.
-- Covers platform geography (states, cities, neighborhoods), platform_forms, platform_services, platform_ai_prompts,
-- and test users (clients + providers) with all related table data populated.
--
-- Test accounts (password: Abc123):
--   clients:  cliente@renovi.com.br, cliente1@renovi.com.br … cliente4@renovi.com.br
--   provider: prestador@renovi.com.br, prestador2@renovi.com.br
--
-- After db reset, upload service-request photos to Storage:
--   yarn seed:dev-images        (offline gradient placeholders)
--   yarn seed:dev-images-real   (picsum.photos, needs internet)

-- ---------------------------------------------------------------------------
-- platform_states
-- ---------------------------------------------------------------------------
insert into public.platform_states (id, ibge_code, name, abbreviation, is_active)
values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 42, 'Santa Catarina', 'SC', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid, 35, 'São Paulo', 'SP', true)
on conflict (ibge_code) do nothing;

-- ---------------------------------------------------------------------------
-- platform_cities
-- ---------------------------------------------------------------------------
insert into public.platform_cities (id, state_id, ibge_code, name, is_active)
values
  (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    4205407,
    'Florianópolis',
    true
  ),
  (
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,
    3550308,
    'São Paulo',
    true
  )
on conflict (state_id, ibge_code) do nothing;

-- ---------------------------------------------------------------------------
-- platform_neighborhoods
-- ---------------------------------------------------------------------------
insert into public.platform_neighborhoods (id, city_id, name, is_active)
values
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a31'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Centro', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Trindade', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Lagoa da Conceição', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid, 'Agronômica', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a35'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'Sé', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a36'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'Pinheiros', true),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a37'::uuid, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid, 'Vila Madalena', true)
on conflict (city_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- platform_forms (default + instalacao eletrica + instalacao ar condicionado)
-- ---------------------------------------------------------------------------
insert into public.platform_forms (id, form_schema, form_version, form_status, description)
values
  (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a42'::uuid,
    '{"version":"2.0","id":"instalacao-eletrica-form","title":"Orçamento - Instalação elétrica","metadata":{"categorySlug":"instalacao-eletrica","categoryId":null,"status":"draft"},"config":{"showProgressBar":true},"steps":[
      {"id":"step-tipo","order":0,"title":"Tipo de serviço","blocks":[
        {"id":"tipo_servico","type":"single_select","label":"Qual tipo de instalação?","required":true,"description_ai":"Type of electrical work: new installation, renovation/expansion, or maintenance/correction.","options":[{"value":"nova","label":"Nova instalação"},{"value":"reforma","label":"Reforma / ampliação"},{"value":"manutencao","label":"Manutenção ou correção"}]},
        {"id":"tipo_imovel","type":"property_type","label":"Tipo de imóvel","required":true,"description_ai":"Property type: residential or commercial.","options":[{"value":"residencial","label":"Residencial"},{"value":"comercial","label":"Comercial"}]},
        {"id":"urgency","type":"urgency","label":"Urgência","required":true,"description_ai":"How urgent the client needs the service: low, medium, or high.","options":[{"value":"low","label":"Baixa"},{"value":"medium","label":"Média"},{"value":"high","label":"Alta"}]}
      ]},
      {"id":"step-detalhes","order":1,"title":"Detalhes técnicos","blocks":[
        {"id":"qtd_pontos","type":"number","label":"Quantidade de pontos ou circuitos","required":true,"min":1,"max":50,"unit":"pontos","description_ai":"Number of electrical points or circuits requested (1-50)."},
        {"id":"aterramento","type":"yes_no","label":"Precisa de aterramento (fio terra)?","required":true,"description_ai":"Whether the client needs grounding (earth wire)."},
        {"id":"descricao","type":"description_ai","label":"Descreva o que precisa (pode usar a IA para sugerir)","required":false,"description_ai":"Free-text description of what the client needs; can be enhanced by AI suggestion."}
      ]},
      {"id":"step-obs","order":2,"title":"Observações","blocks":[
        {"id":"observacoes","type":"textarea","label":"Observações adicionais","required":false,"validation":{"maxLength":500},"description_ai":"Additional notes from the client."},
        {"id":"data_preferida","type":"date","label":"Data preferida para o serviço","required":false,"description_ai":"Preferred date for the service."}
      ]}
    ]}'::jsonb,
    '2.0',
    'active',
    'Form for electrical installation quote requests'
  ),
  (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a43'::uuid,
    '{"version":"2.0","id":"instalacao-ar-condicionado-form","title":"Orçamento - Instalação de ar condicionado","metadata":{"categorySlug":"instalacao-ar-condicionado","categoryId":null,"status":"active"},"config":{"showProgressBar":true},"steps":[
      {"id":"step-tipo","order":0,"title":"Tipo de serviço","blocks":[
        {"id":"tipo_servico","type":"single_select","label":"Qual tipo de serviço precisa?","required":true,"description_ai":"Type of AC service: new installation, maintenance/cleaning, or unit replacement.","options":[{"value":"instalacao_nova","label":"Instalação nova"},{"value":"manutencao","label":"Manutenção ou limpeza"},{"value":"troca","label":"Troca de aparelho"}]},
        {"id":"tipo_imovel","type":"property_type","label":"Tipo de imóvel","required":true,"description_ai":"Property type: residential or commercial.","options":[{"value":"residencial","label":"Residencial"},{"value":"comercial","label":"Comercial"}]},
        {"id":"urgency","type":"urgency","label":"Urgência","required":true,"description_ai":"How urgent the client needs the service."}
      ]},
      {"id":"step-detalhes","order":1,"title":"Detalhes do aparelho","blocks":[
        {"id":"qtd_aparelhos","type":"number","label":"Quantidade de aparelhos","required":true,"min":1,"max":10,"unit":"un","description_ai":"Number of AC units to install or service (1-10)."},
        {"id":"capacidade_btu","type":"single_select","label":"Capacidade (BTU) desejada","required":false,"helpText":"Aproximada por aparelho. Deixe em branco se não souber.","description_ai":"BTU capacity per unit.","options":[{"value":"9000","label":"9.000 BTU"},{"value":"12000","label":"12.000 BTU"},{"value":"18000","label":"18.000 BTU"},{"value":"24000","label":"24.000 BTU"},{"value":"30000","label":"30.000 BTU ou mais"}]},
        {"id":"ja_tem_ponto","type":"yes_no","label":"Já possui ponto elétrico no local?","required":true,"description_ai":"Whether there is already an electrical outlet at the installation point."},
        {"id":"descricao","type":"description_ai","label":"Descreva o que precisa (pode usar a IA para sugerir)","required":false,"description_ai":"Free-text description of the AC installation or service; can be enhanced by AI."}
      ]},
      {"id":"step-obs","order":2,"title":"Observações e data","blocks":[
        {"id":"observacoes","type":"textarea","label":"Observações adicionais","required":false,"validation":{"maxLength":500},"description_ai":"Additional notes from the client."},
        {"id":"data_preferida","type":"date","label":"Data preferida para o serviço","required":false,"description_ai":"Preferred date for the service."},
        {"id":"horario_preferido","type":"single_select","label":"Melhor horário para visita","required":false,"description_ai":"Preferred time slot for the visit.","options":[{"value":"manha","label":"Manhã (8h–12h)"},{"value":"tarde","label":"Tarde (12h–18h)"},{"value":"noite","label":"Noite (18h–20h)"},{"value":"flexivel","label":"Flexível"}]}
      ]}
    ]}'::jsonb,
    '2.0',
    'active',
    'Form for air conditioning installation quote requests'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- platform_ai_prompts (default + instalacao eletrica for generate-smart-description)
-- Must run before platform_services (platform_services.ai_prompt_id references platform_ai_prompts.id).
-- ---------------------------------------------------------------------------
insert into public.platform_ai_prompts (
  id,
  prompt_key,
  name,
  system_prompt,
  impact_description,
  impact_location,
  max_tokens,
  temperature,
  formatting_rules,
  version,
  is_active
)
values
  (
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a51'::uuid,
    'description_default',
    'Default smart description',
    'You help users write a clear, concise description of their service request. Output in plain text, no markdown. Respect the max words and formatting rules.',
    'Descrição do impacto não definida',
    'Local de uso não especificado',
    800,
    0.7,
    '{"max_words": 350, "allow_markdown": false, "use_caps_for_titles": true, "use_block_separation": true}'::jsonb,
    1,
    true
  ),
  (
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a52'::uuid,
    'description_instalacao_eletrica',
    'Smart description - Instalação elétrica',
    'You help users describe their electrical installation request (residential or commercial). Focus on: type of work (new install, renovation, maintenance), number of points/circuits, need for grounding, location details. Output in plain text, no markdown. Be concise and technical when relevant. Respect the max words and formatting rules.',
    'Instalação ou adequação elétrica (pontos, circuitos, aterramento).',
    'Ambiente do imóvel onde o serviço será realizado.',
    800,
    0.7,
    '{"max_words": 350, "allow_markdown": false, "use_caps_for_titles": true, "use_block_separation": true}'::jsonb,
    1,
    true
  ),
  (
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a53'::uuid,
    'description_instalacao_ar_condicionado',
    'Smart description - Instalação de ar condicionado',
    'You help users describe their air conditioning installation or service request (residential or commercial). Focus on: type of service (new installation, maintenance/cleaning, unit replacement), number of units, BTU capacity, whether electrical outlet already exists, room/location details. Output in plain text, no markdown. Be concise. Respect the max words and formatting rules.',
    'Instalação, manutenção ou troca de ar condicionado.',
    'Ambiente onde o(s) aparelho(s) será(ão) instalado(s) ou atendido(s).',
    800,
    0.7,
    '{"max_words": 350, "allow_markdown": false, "use_caps_for_titles": true, "use_block_separation": true}'::jsonb,
    1,
    true
  )
on conflict (prompt_key) do nothing;

-- ---------------------------------------------------------------------------
-- platform_services (default + instalacao eletrica + instalacao ar condicionado)
-- ---------------------------------------------------------------------------
insert into public.platform_services (id, parent_id, form_id, title, description, slug, show_on_request_quote, active, sort_order, ai_prompt_id, icon_key, color_key)
values
  (
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61'::uuid,
    null,
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a42'::uuid,
    'Serviço exemplo',
    'Formulário de orçamento padrão para desenvolvimento local.',
    'servico-exemplo',
    true,
    true,
    0,
    null,
    'Wrench',
    'slate'
  ),
  (
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
    null,
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a42'::uuid,
    'Instalação elétrica',
    'Orçamento para instalação, reforma ou manutenção elétrica residencial e comercial.',
    'instalacao-eletrica',
    true,
    true,
    1,
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a52'::uuid,
    'Zap',
    'yellow_orange'
  ),
  (
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
    null,
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a43'::uuid,
    'Instalação de ar condicionado',
    'Orçamento para instalação nova, manutenção, limpeza ou troca de ar condicionado residencial e comercial.',
    'instalacao-ar-condicionado',
    true,
    true,
    2,
    'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a53'::uuid,
    'Wind',
    'sky_indigo'
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed users for local development
-- clients:  cliente@renovi.com.br, cliente1@ … cliente4@renovi.com.br / Abc123
-- provider: prestador@renovi.com.br, prestador2@renovi.com.br / Abc123
--
-- Triggers chain:
--   auth.users INSERT -> handle_new_user -> profiles INSERT
--   profiles INSERT  -> profiles_sync_role_tables -> role-specific tables
-- After auto-creation we UPDATE the rows to fill in remaining fields.
-- ---------------------------------------------------------------------------

-- 1) auth.users
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '28e30f1d-3c47-441f-94c6-76b6ea0db470',
    'authenticated', 'authenticated',
    'cliente@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Maria da Silva","role":"client"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '38e30f1d-3c47-441f-94c6-76b6ea0db471',
    'authenticated', 'authenticated',
    'cliente1@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ana Souza","role":"client"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '48e30f1d-3c47-441f-94c6-76b6ea0db472',
    'authenticated', 'authenticated',
    'cliente2@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Bruno Costa","role":"client"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '58e30f1d-3c47-441f-94c6-76b6ea0db473',
    'authenticated', 'authenticated',
    'cliente3@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Carla Mendes","role":"client"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '68e30f1d-3c47-441f-94c6-76b6ea0db474',
    'authenticated', 'authenticated',
    'cliente4@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Diego Ramos","role":"client"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    'authenticated', 'authenticated',
    'prestador@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"João Eletricista","role":"provider"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    'authenticated', 'authenticated',
    'prestador2@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Pedro Eletricista","role":"provider"}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

-- 2) auth.identities (required for email/password login)
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (
    '28e30f1d-3c47-441f-94c6-76b6ea0db470',
    '28e30f1d-3c47-441f-94c6-76b6ea0db470',
    '{"sub":"28e30f1d-3c47-441f-94c6-76b6ea0db470","email":"cliente@renovi.com.br"}'::jsonb,
    'email',
    '28e30f1d-3c47-441f-94c6-76b6ea0db470',
    now(), now(), now()
  ),
  (
    '38e30f1d-3c47-441f-94c6-76b6ea0db471',
    '38e30f1d-3c47-441f-94c6-76b6ea0db471',
    '{"sub":"38e30f1d-3c47-441f-94c6-76b6ea0db471","email":"cliente1@renovi.com.br"}'::jsonb,
    'email',
    '38e30f1d-3c47-441f-94c6-76b6ea0db471',
    now(), now(), now()
  ),
  (
    '48e30f1d-3c47-441f-94c6-76b6ea0db472',
    '48e30f1d-3c47-441f-94c6-76b6ea0db472',
    '{"sub":"48e30f1d-3c47-441f-94c6-76b6ea0db472","email":"cliente2@renovi.com.br"}'::jsonb,
    'email',
    '48e30f1d-3c47-441f-94c6-76b6ea0db472',
    now(), now(), now()
  ),
  (
    '58e30f1d-3c47-441f-94c6-76b6ea0db473',
    '58e30f1d-3c47-441f-94c6-76b6ea0db473',
    '{"sub":"58e30f1d-3c47-441f-94c6-76b6ea0db473","email":"cliente3@renovi.com.br"}'::jsonb,
    'email',
    '58e30f1d-3c47-441f-94c6-76b6ea0db473',
    now(), now(), now()
  ),
  (
    '68e30f1d-3c47-441f-94c6-76b6ea0db474',
    '68e30f1d-3c47-441f-94c6-76b6ea0db474',
    '{"sub":"68e30f1d-3c47-441f-94c6-76b6ea0db474","email":"cliente4@renovi.com.br"}'::jsonb,
    'email',
    '68e30f1d-3c47-441f-94c6-76b6ea0db474',
    now(), now(), now()
  ),
  (
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    '{"sub":"5d09e025-20a2-4842-aeef-324d42a431e1","email":"prestador@renovi.com.br"}'::jsonb,
    'email',
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    now(), now(), now()
  ),
  (
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    '{"sub":"4cf92e3a-64cd-4491-998e-9163138f8e96","email":"prestador2@renovi.com.br"}'::jsonb,
    'email',
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- 3) Enrich profiles with phone
update public.profiles set phone = '(48) 99123-4567'
where id = '28e30f1d-3c47-441f-94c6-76b6ea0db470' and phone is null;

update public.profiles set phone = '(48) 99234-5678'
where id = '38e30f1d-3c47-441f-94c6-76b6ea0db471' and phone is null;

update public.profiles set phone = '(48) 99345-6789'
where id = '48e30f1d-3c47-441f-94c6-76b6ea0db472' and phone is null;

update public.profiles set phone = '(48) 99456-7890'
where id = '58e30f1d-3c47-441f-94c6-76b6ea0db473' and phone is null;

update public.profiles set phone = '(48) 99567-8901'
where id = '68e30f1d-3c47-441f-94c6-76b6ea0db474' and phone is null;

update public.profiles set phone = '(48) 98765-4321'
where id = '5d09e025-20a2-4842-aeef-324d42a431e1' and phone is null;

update public.profiles set phone = '(48) 98654-3210'
where id = '4cf92e3a-64cd-4491-998e-9163138f8e96' and phone is null;

-- 4) client_profiles_private (CPF)
update public.client_profiles_private set cpf = '504.432.630-51'
where client_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470' and cpf is null;

update public.client_profiles_private set cpf = '111.222.333-44'
where client_id = '38e30f1d-3c47-441f-94c6-76b6ea0db471' and cpf is null;

update public.client_profiles_private set cpf = '222.333.444-55'
where client_id = '48e30f1d-3c47-441f-94c6-76b6ea0db472' and cpf is null;

update public.client_profiles_private set cpf = '333.444.555-66'
where client_id = '58e30f1d-3c47-441f-94c6-76b6ea0db473' and cpf is null;

update public.client_profiles_private set cpf = '444.555.666-77'
where client_id = '68e30f1d-3c47-441f-94c6-76b6ea0db474' and cpf is null;

-- 5) provider_profiles_private (entity + CPF)
UPDATE public.provider_profiles_private
SET
  entity_type = 'pj',
  cpf = null,
  cnpj = '49.769.985/0001-03',
  razao_social = 'João LTDA',
  nome_fantasia = 'João Eletricista',
  legal_representative_name = 'João Pedro Eletricista',
  legal_representative_cpf = '987.654.321-00',
  legal_representative_phone = '(48) 98765-4321',
  commercial_contact = 'joao@prestway.com',
  bank_institution_code = '84',
  bank_branch = '1410',
  bank_account = '303939',
  pix_key = 'joao@prestway.com',
  identity_doc_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/legal-rep-id/doc.pdf',
  address_proof_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/address-proof/doc.pdf',
  corporate_charter_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/corporate-charter/doc.pdf',
  legal_rep_doc_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/legal-rep-id/doc.pdf',
  updated_at = now()
WHERE provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1';

update public.provider_profiles_private
set entity_type = 'pf',
    cpf = '111.222.333-88'
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96' and cpf is null;

-- 6) provider_profiles_public (slug, display_name, bio, visibility)
update public.provider_profiles_public
set slug = 'joao-eletricista',
    display_name = 'João Eletricista',
    bio = 'Eletricista profissional com mais de 10 anos de experiência em instalações residenciais e comerciais. Especialista em instalação elétrica, manutenção preventiva e instalação de ar condicionado. Atendo toda a região de Florianópolis.',
    profile_visibility = 'public'
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1';

update public.provider_profiles_public
set slug = 'pedro-eletricista',
    display_name = 'Pedro Eletricista',
    bio = 'Eletricista e instalador de ar condicionado em Florianópolis. Atendo instalações residenciais e comerciais, com foco em segurança e acabamento.',
    profile_visibility = 'public'
where provider_id = '4cf92e3a-64cd-4491-998e-9163138f8e96';

-- 7) client_addresses (Florianópolis)
insert into public.client_addresses (
  id, client_id, label, street, number, complement,
  neighborhood, zip_code, state_id, city_id,
  is_default, is_active, location, h3_index
)
values
  (
    'acd13138-0d54-431f-a672-55903f31301e',
    '28e30f1d-3c47-441f-94c6-76b6ea0db470',
    'Casa',
    'Rua Felipe Schmidt',
    '515',
    'Apto 301',
    'Centro',
    '88010-000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    true,
    true,
    ST_SetSRID(ST_MakePoint(-48.5482, -27.5954), 4326)::geography,
    '89a91b46253ffff'
  ),
  (
    'bcd13138-0d54-431f-a672-55903f31301f',
    '38e30f1d-3c47-441f-94c6-76b6ea0db471',
    'Apartamento',
    'Rua Deodoro',
    '220',
    'Bloco B',
    'Trindade',
    '88036-002',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    true,
    true,
    ST_SetSRID(ST_MakePoint(-48.5012, -27.5978), 4326)::geography,
    '89a91b4762fffff'
  ),
  (
    'ccd13138-0d54-431f-a672-55903f313020',
    '48e30f1d-3c47-441f-94c6-76b6ea0db472',
    'Casa',
    'Rua João Pinto',
    '88',
    null,
    'Agronômica',
    '88025-200',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    true,
    true,
    ST_SetSRID(ST_MakePoint(-48.5123, -27.5821), 4326)::geography,
    '89a91b473c7ffff'
  ),
  (
    'dcd13138-0d54-431f-a672-55903f313021',
    '58e30f1d-3c47-441f-94c6-76b6ea0db473',
    'Escritório',
    'Rua Lauro Linhares',
    '1024',
    'Sala 12',
    'Trindade',
    '88036-001',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    true,
    true,
    ST_SetSRID(ST_MakePoint(-48.4988, -27.5995), 4326)::geography,
    '89a91b4762bffff'
  ),
  (
    'ecd13138-0d54-431f-a672-55903f313022',
    '68e30f1d-3c47-441f-94c6-76b6ea0db474',
    'Casa',
    'Rua Artista Bitencourt',
    '45',
    null,
    'Centro',
    '88020-060',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21'::uuid,
    true,
    true,
    ST_SetSRID(ST_MakePoint(-48.5456, -27.5932), 4326)::geography,
    '89a91b4624bffff'
  )
on conflict (id) do nothing;

-- 8) provider_offered_services
insert into public.provider_offered_services (provider_id, service_id, sort_order)
values
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62', 0),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63', 1),
  ('4cf92e3a-64cd-4491-998e-9163138f8e96', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62', 0),
  ('4cf92e3a-64cd-4491-998e-9163138f8e96', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63', 1)
on conflict (provider_id, service_id) do nothing;

-- 9) provider_portfolio_items
insert into public.provider_portfolio_items (
  id, provider_id, title, description, service_id,
  execution_date, image_paths, city_region,
  visibility, featured, sort_order
)
values
  (
    'a97b4cba-0813-410e-ae15-2749568bd899'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    'Instalação elétrica completa - residência',
    'Instalação de 20 pontos elétricos em residência de 3 quartos, incluindo aterramento e quadro de distribuição novo.',
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
    '2026-01-15',
    '{}',
    'Florianópolis - Centro',
    'public',
    true,
    0
  ),
  (
    'e2731794-6ce9-4f84-b775-df887caef6e9'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    'Instalação de 3 splits - escritório comercial',
    'Instalação de 3 aparelhos de ar condicionado split (12.000 BTU cada) em escritório comercial com infraestrutura elétrica dedicada.',
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
    '2026-02-20',
    '{}',
    'Florianópolis - Trindade',
    'public',
    true,
    1
  ),
  (
    'b97b4cba-0813-410e-ae15-2749568bd89a'::uuid,
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    'Instalação elétrica - apartamento',
    'Instalação de 12 pontos elétricos e troca de quadro em apartamento no Centro.',
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
    '2026-03-10',
    '{}',
    'Florianópolis - Centro',
    'public',
    true,
    0
  ),
  (
    'f2731794-6ce9-4f84-b775-df887caef6e9'::uuid,
    '4cf92e3a-64cd-4491-998e-9163138f8e96',
    'Split 12.000 BTU - residência',
    'Instalação de split com infraestrutura elétrica dedicada e dreno.',
    'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
    '2026-04-05',
    '{}',
    'Florianópolis - Agronômica',
    'public',
    true,
    1
  )
on conflict (id) do nothing;

-- 10) provider_service_area_neighborhoods (Florianópolis: Centro, Trindade, Agronômica)
insert into public.provider_service_area_neighborhoods (provider_id, neighborhood_id)
values
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a31'),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32'),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34'),
  ('4cf92e3a-64cd-4491-998e-9163138f8e96', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a31'),
  ('4cf92e3a-64cd-4491-998e-9163138f8e96', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32'),
  ('4cf92e3a-64cd-4491-998e-9163138f8e96', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34')
on conflict (provider_id, neighborhood_id) do nothing;

-- 11) service_requests (21 total: eletrica or ar condicionado)
--     form_schema snapshot from platform_forms via platform_services.form_id.
--     10 negotiated (seeded via RPCs below), 10 open (incl. matching-wait demo), 1 cancelled.
insert into public.service_requests (
  id, client_id, service_id, address_id,
  title, description, form_data, form_schema, form_version,
  status, urgency, scope_complexity, tags,
  missing_info_warnings, suggested_equipment, suggested_materials,
  estimated_duration_hint
)
select
  d.id,
  d.client_id,
  d.service_id,
  d.address_id,
  d.title,
  d.description,
  d.form_data,
  pf.form_schema,
  pf.form_version,
  d.status::public.service_request_status,
  d.urgency,
  d.scope_complexity,
  d.tags,
  d.missing_info_warnings,
  d.suggested_equipment,
  d.suggested_materials,
  d.estimated_duration_hint
from (
  values
    (
      '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'acd13138-0d54-431f-a672-55903f31301e'::uuid,
      'Instalação elétrica - 5 pontos novos',
      'Preciso instalar cinco pontos de tomada novos na sala de estar e na cozinha. O imóvel foi construído nos anos 1970, a fiação interna é antiga e não há aterramento no quadro principal. Gostaria de aproveitar o serviço para revisar o disjuntor geral e garantir que os novos pontos fiquem em circuito dedicado, evitando quedas quando uso micro-ondas e forno ao mesmo tempo.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"medium","qtd_pontos":5,"aterramento":true,"descricao":"Cinco tomadas novas na sala e cozinha, com revisão do disjuntor geral.","observacoes":"Preferência por tomadas padrão NBR e canaletas discretas na parede da cozinha.","data_preferida":"2026-06-18"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['residencial', 'instalação elétrica', 'tomadas', 'aterramento'],
      array['Não informado se o quadro comporta novo disjuntor dedicado', 'Distância exata entre sala e cozinha para estimativa de cabo'],
      array['voltage_tester', 'wire_strippers', 'drill', 'insulated_screwdrivers', 'multimeter']::text[],
      array['cable_wire', 'outlets', 'breakers', 'junction_boxes', 'electrical_tape', 'ground_wire']::text[],
      '4_to_8h'
    ),
    (
      '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'acd13138-0d54-431f-a672-55903f31301e'::uuid,
      'Instalação elétrica - quadro e aterramento',
      'Reforma completa do quadro de distribuição do apartamento no Centro, incluindo troca de disjuntores antigos, organização dos circuitos e implementação de aterramento conforme norma. O quadro atual está superlotado, sem identificação clara dos circuitos e com sinais de aquecimento em um disjuntor de 20A. Preciso de laudo visual e execução com materiais certificados.',
      '{"tipo_servico":"reforma","tipo_imovel":"residencial","urgency":"high","qtd_pontos":8,"aterramento":true,"descricao":"Substituição do quadro, reorganização de circuitos e aterramento completo.","observacoes":"Condomínio exige serviço em horário comercial e proteção de área comum no corredor.","data_preferida":"2026-06-12"}'::jsonb,
      'OPEN', 'high', 'complex',
      array['urgente', 'quadro elétrico', 'aterramento', 'reforma elétrica'],
      array['Não foi informada potência contratada com a concessionária'],
      array['multimeter', 'non_contact_voltage_tester', 'insulated_screwdrivers', 'wire_strippers', 'drill']::text[],
      array['breakers', 'panel_board', 'cable_wire', 'junction_boxes', 'ground_wire', 'conduit']::text[],
      '1_day'
    ),
    (
      '8017e002-5a32-44e7-b8da-1727a14f4d02'::uuid,
      '38e30f1d-3c47-441f-94c6-76b6ea0db471'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'bcd13138-0d54-431f-a672-55903f31301f'::uuid,
      'Instalação de ar condicionado - 2 splits',
      'Instalação de dois aparelhos split inverter de 12.000 BTU, um no quarto principal e outro no quarto de hóspedes, ambos no segundo andar. Não há ponto elétrico dedicado próximo às paredes escolhidas e o dreno precisa ser conduzido até a área de serviço. Busco profissional que faça a passagem de tubulação com acabamento limpo e teste de vazamento.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"medium","qtd_aparelhos":2,"capacidade_btu":"12000","ja_tem_ponto":false,"descricao":"Dois splits de 12 mil BTU no segundo andar com dreno até área de serviço.","observacoes":"Paredes externas em alvenaria; evitar furação visível na fachada frontal.","data_preferida":"2026-06-20","horario_preferido":"manha"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['ar condicionado', 'split', 'instalação nova', 'residencial'],
      array['Marca/modelo dos aparelhos ainda não definidos'],
      array['vacuum_pump', 'manifold_gauges', 'drill', 'level', 'leak_detector']::text[],
      array['line_set', 'refrigerant', 'duct_tape', 'screws', 'cable_wire']::text[],
      '1_day'
    ),
    (
      '8017e003-5a32-44e7-b8da-1727a14f4d03'::uuid,
      '48e30f1d-3c47-441f-94c6-76b6ea0db472'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'ccd13138-0d54-431f-a672-55903f313020'::uuid,
      'Instalação elétrica - iluminação externa',
      'Instalação de quatro pontos de iluminação na área gourmet e no jardim lateral, com aterramento e proteção adequada para área externa (IP65). Hoje só existe uma tomada externa antiga sem aterramento. Desejo interruptores duplos na cozinha para controlar os circuitos separadamente e pontos preparados para futura instalação de string LED.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"low","qtd_pontos":4,"aterramento":true,"descricao":"Quatro pontos de luz externos com aterramento e interruptores na cozinha.","observacoes":"Área gourmet coberta; jardim exposto à chuva.","data_preferida":"2026-07-05"}'::jsonb,
      'OPEN', 'low', 'medium',
      array['iluminação externa', 'área gourmet', 'aterramento', 'residencial'],
      array['Não informado se há eletroduto existente até o jardim'],
      array['drill', 'voltage_tester', 'wire_strippers', 'ladder', 'level']::text[],
      array['cable_wire', 'switches', 'outlets', 'junction_boxes', 'ground_wire', 'conduit']::text[],
      '4_to_8h'
    ),
    (
      '8017e004-5a32-44e7-b8da-1727a14f4d04'::uuid,
      '58e30f1d-3c47-441f-94c6-76b6ea0db473'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'dcd13138-0d54-431f-a672-55903f313021'::uuid,
      'Instalação de ar condicionado - sala comercial',
      'Instalação de um split de 24.000 BTU na sala de reuniões de escritório comercial em Trindade. Já existe ponto elétrico 220V dedicado e dreno próximo, mas a tubulação antiga foi removida na última reforma. Pé direito de 3,2 m exige escada alta e fixação reforçada. Preciso do serviço concluído antes de reunião com cliente na outra semana.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"comercial","urgency":"high","qtd_aparelhos":1,"capacidade_btu":"24000","ja_tem_ponto":true,"descricao":"Split 24 mil BTU em sala comercial com pé direito alto.","observacoes":"Horário preferencial após 18h para não interromper atendimento.","data_preferida":"2026-06-14","horario_preferido":"noite"}'::jsonb,
      'OPEN', 'high', 'medium',
      array['comercial', 'ar condicionado', 'urgente', 'sala de reuniões'],
      array['Não confirmado se o dreno existente ainda está funcional'],
      array['vacuum_pump', 'manifold_gauges', 'extension_ladder', 'drill', 'level']::text[],
      array['line_set', 'refrigerant', 'screws', 'cable_wire', 'condensate_pump']::text[],
      '4_to_8h'
    ),
    (
      '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid,
      '68e30f1d-3c47-441f-94c6-76b6ea0db474'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'ecd13138-0d54-431f-a672-55903f313022'::uuid,
      'Instalação elétrica - tomadas home office',
      'Instalação de seis pontos elétricos dedicados para home office: computador, monitor duplo, impressora, roteador, estabilizador e ponto reserva. Solicito circuito separado no quadro, aterramento individual testado e tomadas com filtro de linha embutido onde possível. A parede é drywall com estrutura metálica — preciso saber se usa busway ou eletroduto aparente.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"medium","qtd_pontos":6,"aterramento":true,"descricao":"Seis pontos dedicados para home office com circuito separado.","observacoes":"Parede drywall; preferência por eletroduto discreto.","data_preferida":"2026-06-22"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['home office', 'tomadas dedicadas', 'drywall', 'residencial'],
      array['Capacidade do quadro para novo circuito 20A não confirmada'],
      array['stud_finder', 'multimeter', 'drill', 'wire_fish_tape', 'insulated_screwdrivers']::text[],
      array['cable_wire', 'outlets', 'breakers', 'conduit', 'junction_boxes', 'gfci_outlet']::text[],
      '4_to_8h'
    ),
    (
      '8017e006-5a32-44e7-b8da-1727a14f4d06'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'acd13138-0d54-431f-a672-55903f31301e'::uuid,
      'Instalação de ar condicionado - sala',
      'Instalação de split inverter 18.000 BTU na sala de estar de apartamento no Centro. A parede da fachada é compartilhada com o vizinho e o condomínio restringe unidade condensadora na varanda. Será necessário passar tubulação pela fachada lateral e criar ponto elétrico 220V. Ambiente de 22 m² com insolação oeste forte no final da tarde.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"medium","qtd_aparelhos":1,"capacidade_btu":"18000","ja_tem_ponto":false,"descricao":"Split 18 mil BTU na sala com tubulação pela fachada lateral.","observacoes":"Consultar regras do condomínio sobre fixação externa.","data_preferida":"2026-06-25","horario_preferido":"tarde"}'::jsonb,
      'OPEN', 'medium', 'complex',
      array['ar condicionado', 'sala', 'fachada', 'condomínio'],
      array['Autorização do condomínio para fixação externa pendente'],
      array['vacuum_pump', 'manifold_gauges', 'drill', 'level', 'extension_ladder']::text[],
      array['line_set', 'refrigerant', 'cable_wire', 'breakers', 'screws']::text[],
      '1_day'
    ),
    (
      '8017e007-5a32-44e7-b8da-1727a14f4d07'::uuid,
      '38e30f1d-3c47-441f-94c6-76b6ea0db471'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'bcd13138-0d54-431f-a672-55903f31301f'::uuid,
      'Instalação elétrica - cozinha',
      'Instalação de dez pontos elétricos na cozinha planejada recém-montada: geladeira, fogão elétrico, micro-ondas, forno, cafeteira, liquidificador, iluminação sob armário, duas tomadas na ilha e ponto para purificador. Cozinha em reforma finalizada, eletrodutos ainda não fechados. Necessário aterramento em todos os pontos e circuito dedicado para fogão.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"medium","qtd_pontos":10,"aterramento":true,"descricao":"Dez pontos na cozinha planejada com circuito dedicado para fogão.","observacoes":"Projeto da marcenaria já indica posição das tomadas.","data_preferida":"2026-06-19"}'::jsonb,
      'OPEN', 'medium', 'complex',
      array['cozinha planejada', 'instalação elétrica', 'reforma', 'residencial'],
      array['Potência do fogão elétrico (220V ou 380V) não especificada'],
      array['multimeter', 'wire_strippers', 'drill', 'level', 'insulated_screwdrivers']::text[],
      array['cable_wire', 'outlets', 'breakers', 'junction_boxes', 'conduit', 'ground_wire']::text[],
      '1_to_2_days'
    ),
    (
      '8017e008-5a32-44e7-b8da-1727a14f4d08'::uuid,
      '48e30f1d-3c47-441f-94c6-76b6ea0db472'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'ccd13138-0d54-431f-a672-55903f313020'::uuid,
      'Instalação de ar condicionado - 3 quartos',
      'Instalação de três splits de 9.000 BTU nos quartos de solteiro, casal e escritório. Condomínio exige dreno coletivo na área de serviço e proíbe gotejamento na fachada. Não há pontos elétricos próximos em dois dos quartos. Busco execução em etapas se necessário, começando pelo quarto principal.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"low","qtd_aparelhos":3,"capacidade_btu":"9000","ja_tem_ponto":false,"descricao":"Três splits 9 mil BTU com dreno coletivo conforme regras do condomínio.","observacoes":"Preferência por instalação sequencial em três dias.","data_preferida":"2026-07-10","horario_preferido":"flexivel"}'::jsonb,
      'OPEN', 'low', 'complex',
      array['ar condicionado', 'multi ambiente', 'condomínio', 'dreno coletivo'],
      array['Trajeto completo do dreno coletivo até área de serviço não mapeado'],
      array['vacuum_pump', 'manifold_gauges', 'drill', 'level', 'leak_detector']::text[],
      array['line_set', 'refrigerant', 'cable_wire', 'breakers', 'condensate_pump']::text[],
      '2_to_5_days'
    ),
    (
      '8017e009-5a32-44e7-b8da-1727a14f4d09'::uuid,
      '58e30f1d-3c47-441f-94c6-76b6ea0db473'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'dcd13138-0d54-431f-a672-55903f313021'::uuid,
      'Instalação elétrica - loja comercial',
      'Adequação elétrica completa de loja de 45 m² em shopping: quinze pontos entre vitrine, caixa, estoque e provador, iluminação trifásica de destaque e aterramento. Instalação atual é provisória da construtora e não suporta carga dos equipamentos de climatização previstos. Prazo apertado para inauguração em 10 dias.',
      '{"tipo_servico":"reforma","tipo_imovel":"comercial","urgency":"high","qtd_pontos":15,"aterramento":true,"descricao":"Adequação elétrica de loja comercial com 15 pontos e iluminação de vitrine.","observacoes":"Trabalho deve respeitar horário do shopping (após 22h).","data_preferida":"2026-06-11"}'::jsonb,
      'OPEN', 'high', 'complex',
      array['comercial', 'loja', 'shopping', 'urgente', 'iluminação'],
      array['Projeto elétrico aprovado pelo shopping não anexado'],
      array['multimeter', 'drill', 'wire_strippers', 'ladder', 'non_contact_voltage_tester']::text[],
      array['cable_wire', 'breakers', 'panel_board', 'outlets', 'led_bulbs', 'conduit']::text[],
      '2_to_5_days'
    ),
    (
      '8017e00a-5a32-44e7-b8da-1727a14f4d0a'::uuid,
      '68e30f1d-3c47-441f-94c6-76b6ea0db474'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'ecd13138-0d54-431f-a672-55903f313022'::uuid,
      'Instalação de ar condicionado - consultório',
      'Instalação de dois splits de 12.000 BTU em consultório médico no Centro: sala de atendimento e sala de espera. Já existem pontos elétricos e infraestrutura parcial de tubulação de instalação anterior. Necessário higienizar linhas, testar vazamento e garantir nível sonoro baixo. Atendimento ocorre de segunda a sexta, 8h–18h.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"comercial","urgency":"medium","qtd_aparelhos":2,"capacidade_btu":"12000","ja_tem_ponto":true,"descricao":"Dois splits em consultório reutilizando infraestrutura parcial existente.","observacoes":"Evitar poeira excessiva durante expediente; preferir sábado.","data_preferida":"2026-06-21","horario_preferido":"manha"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['consultório', 'comercial', 'ar condicionado', 'clínica'],
      array['Estado das linhas frigorígenas existentes desconhecido'],
      array['vacuum_pump', 'manifold_gauges', 'leak_detector', 'drill', 'level']::text[],
      array['line_set', 'refrigerant', 'filter', 'screws']::text[],
      '1_day'
    ),
    (
      '8017e010-5a32-44e7-b8da-1727a14f4d10'::uuid,
      '38e30f1d-3c47-441f-94c6-76b6ea0db471'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'bcd13138-0d54-431f-a672-55903f31301f'::uuid,
      'Instalação de ar condicionado - manutenção e limpeza',
      'Manutenção preventiva e limpeza completa de dois aparelhos split de 12.000 BTU instalados há três anos. Ambos apresentam queda de desempenho, mau cheiro ao ligar e gotejamento interno ocasional. Unidades estão em quartos separados, com acesso fácil. Desejo verificação de carga de gás e limpeza de bandeja e filtros.',
      '{"tipo_servico":"manutencao","tipo_imovel":"residencial","urgency":"low","qtd_aparelhos":2,"ja_tem_ponto":true,"descricao":"Limpeza e manutenção de dois splits com queda de desempenho.","observacoes":"Aparelhos da marca Fujitsu, modelos de 2023.","data_preferida":"2026-07-08","horario_preferido":"tarde"}'::jsonb,
      'OPEN', 'low', 'simple',
      array['manutenção', 'limpeza', 'ar condicionado', 'preventiva'],
      array['Histórico de última manutenção não informado'],
      array['manifold_gauges', 'vacuum_pump', 'leak_detector', 'ladder']::text[],
      array['filter', 'cleaning_solution', 'refrigerant']::text[],
      '2_to_4h'
    ),
    (
      '8017e011-5a32-44e7-b8da-1727a14f4d11'::uuid,
      '48e30f1d-3c47-441f-94c6-76b6ea0db472'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'ccd13138-0d54-431f-a672-55903f313020'::uuid,
      'Instalação elétrica - chuveiro e tomadas banheiro',
      'Substituição do circuito do chuveiro elétrico e instalação de três tomadas no banheiro social com proteção DR. Chuveiro atual de 5500W desarma o disjuntor geral com frequência. Fiação aparente precisa ser substituída por eletroduto e cabo dimensionado corretamente. Urgente pois banheiro é o único do andar.',
      '{"tipo_servico":"manutencao","tipo_imovel":"residencial","urgency":"high","qtd_pontos":4,"aterramento":true,"descricao":"Circuito dedicado para chuveiro 5500W e três tomadas com DR no banheiro.","observacoes":"Disjuntor atual é de 40A geral compartilhado.","data_preferida":"2026-06-10"}'::jsonb,
      'OPEN', 'high', 'medium',
      array['urgente', 'chuveiro', 'banheiro', 'disjuntor', 'residencial'],
      array['Bitola exata do cabo existente não verificada'],
      array['multimeter', 'wire_strippers', 'drill', 'insulated_screwdrivers']::text[],
      array['cable_wire', 'breakers', 'outlets', 'conduit', 'gfci_outlet']::text[],
      '4_to_8h'
    ),
    (
      '8017e012-5a32-44e7-b8da-1727a14f4d12'::uuid,
      '58e30f1d-3c47-441f-94c6-76b6ea0db473'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'dcd13138-0d54-431f-a672-55903f313021'::uuid,
      'Instalação de ar condicionado - troca de aparelho',
      'Troca de aparelho split antigo (provavelmente 9.000 BTU) por novo de 12.000 BTU na sala comercial. Manter tubulação e suportes existentes se estiverem em bom estado. Ponto elétrico 220V já disponível. Aparelho antigo funciona mas consome muito e não resfria adequadamente em dias quentes.',
      '{"tipo_servico":"troca","tipo_imovel":"comercial","urgency":"medium","qtd_aparelhos":1,"capacidade_btu":"12000","ja_tem_ponto":true,"descricao":"Troca de split antigo por 12 mil BTU reutilizando infraestrutura.","observacoes":"Descarte do aparelho antigo incluído no orçamento se possível.","data_preferida":"2026-06-17","horario_preferido":"tarde"}'::jsonb,
      'OPEN', 'medium', 'simple',
      array['troca', 'ar condicionado', 'comercial', 'split'],
      array['Compatibilidade das linhas existentes com novo BTU não confirmada'],
      array['vacuum_pump', 'manifold_gauges', 'wrench_set', 'level']::text[],
      array['line_set', 'refrigerant', 'screws']::text[],
      '2_to_4h'
    ),
    (
      '8017e013-5a32-44e7-b8da-1727a14f4d13'::uuid,
      '68e30f1d-3c47-441f-94c6-76b6ea0db474'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'ecd13138-0d54-431f-a672-55903f313022'::uuid,
      'Instalação elétrica - garagem',
      'Instalação de três pontos na garagem coberta: luminária LED central, tomada para aspirador/wallbox futuro e interruptor duplo na entrada. Imóvel não possui aterramento na área externa coberta. Garagem tem 18 m², teto em laje com conduíte parcialmente disponível.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"low","qtd_pontos":3,"aterramento":false,"descricao":"Três pontos na garagem coberta com luminária LED e tomada reserva.","observacoes":"Wallbox não será instalado agora; apenas preparar ponto.","data_preferida":"2026-07-15"}'::jsonb,
      'OPEN', 'low', 'simple',
      array['garagem', 'iluminação', 'tomada', 'residencial'],
      array['Necessidade futura de wallbox pode exigir circuito dedicado maior'],
      array['drill', 'wire_strippers', 'voltage_tester', 'ladder']::text[],
      array['cable_wire', 'outlets', 'switches', 'led_bulbs', 'conduit']::text[],
      '2_to_4h'
    ),
    (
      '8017e014-5a32-44e7-b8da-1727a14f4d14'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'acd13138-0d54-431f-a672-55903f31301e'::uuid,
      'Instalação de ar condicionado - quarto casal',
      'Instalação de split inverter 12.000 BTU no quarto de casal com alta insolação no período da tarde. Parede externa disponível para unidade condensadora na varanda envidraçada. Não há ponto 220V — apenas tomada 127V existente que alimenta mesa de cabeceira. Preferência por aparelho silencioso (sleep mode).',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"medium","qtd_aparelhos":1,"capacidade_btu":"12000","ja_tem_ponto":false,"descricao":"Split 12 mil BTU no quarto casal com ponto 220V novo.","observacoes":"Varanda envidraçada; verificar ventilação da condensadora.","data_preferida":"2026-06-28","horario_preferido":"manha"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['quarto', 'ar condicionado', 'inverter', 'residencial'],
      array['Marca preferida do aparelho ainda em definição'],
      array['vacuum_pump', 'manifold_gauges', 'drill', 'level']::text[],
      array['line_set', 'refrigerant', 'cable_wire', 'breakers']::text[],
      '4_to_8h'
    ),
    (
      '8017e015-5a32-44e7-b8da-1727a14f4d15'::uuid,
      '38e30f1d-3c47-441f-94c6-76b6ea0db471'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'bcd13138-0d54-431f-a672-55903f31301f'::uuid,
      'Instalação elétrica - varanda gourmet',
      'Instalação de cinco pontos na varanda gourmet coberta: churrasqueira elétrica, geladeira compacta, iluminação, tomada para som ambiente e ponto reserva. Ambiente semiaberto exige tomadas e interruptores com grau de proteção IP. Aterramento obrigatório. Churrasqueira elétrica de 3.000W já comprada.',
      '{"tipo_servico":"nova","tipo_imovel":"residencial","urgency":"medium","qtd_pontos":5,"aterramento":true,"descricao":"Cinco pontos na varanda gourmet com proteção IP e circuito para churrasqueira.","observacoes":"Piso porcelanato; cuidado com furação.","data_preferida":"2026-06-24"}'::jsonb,
      'OPEN', 'medium', 'medium',
      array['varanda gourmet', 'exterior', 'churrasqueira elétrica', 'residencial'],
      array['Modelo exato da churrasqueira elétrica não informado no pedido original'],
      array['drill', 'voltage_tester', 'wire_strippers', 'level', 'insulated_screwdrivers']::text[],
      array['cable_wire', 'outlets', 'breakers', 'ground_wire', 'junction_boxes']::text[],
      '4_to_8h'
    ),
    (
      '8017e016-5a32-44e7-b8da-1727a14f4d16'::uuid,
      '48e30f1d-3c47-441f-94c6-76b6ea0db472'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'ccd13138-0d54-431f-a672-55903f313020'::uuid,
      'Instalação de ar condicionado - sala e quarto',
      'Instalação de dois aparelhos em apartamento recém-reformado: split 18.000 BTU na sala (28 m²) e 9.000 BTU no quarto. Obra de gesso já executada — necessário planejamento cuidadoso da passagem de tubulação. Sem pontos elétricos dedicados. Preferência por condensadoras agrupadas na varanda técnica.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"medium","qtd_aparelhos":2,"capacidade_btu":"18000","ja_tem_ponto":false,"descricao":"Dois splits (sala 18k + quarto 9k) com condensadoras na varanda técnica.","observacoes":"Gesso novo; minimizar quebras.","data_preferida":"2026-07-01","horario_preferido":"flexivel"}'::jsonb,
      'OPEN', 'medium', 'complex',
      array['multi split', 'reforma', 'sala e quarto', 'residencial'],
      array['Capacidade da varanda técnica para duas condensadoras não medida'],
      array['vacuum_pump', 'manifold_gauges', 'drill', 'level', 'leak_detector']::text[],
      array['line_set', 'refrigerant', 'cable_wire', 'breakers', 'condensate_pump']::text[],
      '1_to_2_days'
    ),
    (
      '8017e017-5a32-44e7-b8da-1727a14f4d17'::uuid,
      '58e30f1d-3c47-441f-94c6-76b6ea0db473'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
      'dcd13138-0d54-431f-a672-55903f313021'::uuid,
      'Instalação elétrica - sala de servidores',
      'Instalação de oito pontos dedicados com aterramento em sala climatizada para rack de servidores: dois circuitos independentes, tomadas duplas por baia e ponto para PDU. Ambiente comercial com piso elevado. Exige bitola adequada e identificação de circuitos. Projeto deve considerar UPS de 3 kVA já instalado.',
      '{"tipo_servico":"nova","tipo_imovel":"comercial","urgency":"high","qtd_pontos":8,"aterramento":true,"descricao":"Oito pontos dedicados para rack com dois circuitos independentes e aterramento.","observacoes":"Acesso ao rack apenas com autorização; agendar com TI.","data_preferida":"2026-06-13"}'::jsonb,
      'OPEN', 'high', 'complex',
      array['servidor', 'rack', 'comercial', 'TI', 'urgente'],
      array['Diagrama unifilar da sala não disponível'],
      array['multimeter', 'cable_tester', 'insulated_screwdrivers', 'label_maker', 'drill']::text[],
      array['cable_wire', 'outlets', 'breakers', 'panel_board', 'ground_wire', 'surge_protector']::text[],
      '1_day'
    ),
    (
      '8017e018-5a32-44e7-b8da-1727a14f4d18'::uuid,
      '68e30f1d-3c47-441f-94c6-76b6ea0db474'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'ecd13138-0d54-431f-a672-55903f313022'::uuid,
      'Instalação de ar condicionado - cancelado após negociação',
      'Instalação de split 9.000 BTU no quarto de solteiro. O prestador iniciou conversa, tirou dúvidas sobre passagem de tubulação e visita técnica, mas o cliente decidiu cancelar o pedido antes de receber proposta formal — encontrou outro profissional mais barato. Imóvel térreo, parede externa disponível, sem ponto elétrico dedicado.',
      '{"tipo_servico":"instalacao_nova","tipo_imovel":"residencial","urgency":"low","qtd_aparelhos":1,"capacidade_btu":"9000","ja_tem_ponto":false,"descricao":"Split 9 mil BTU no quarto; negociação iniciada e pedido cancelado pelo cliente.","observacoes":"Cancelado durante fase de descoberta no chat, sem proposta enviada.","data_preferida":"2026-07-20","horario_preferido":"flexivel"}'::jsonb,
      'OPEN', 'low', 'simple',
      array['cancelado', 'ar condicionado', 'negociação', 'residencial'],
      array['Cliente não confirmou se retomará o serviço no futuro'],
      array['vacuum_pump', 'manifold_gauges', 'drill']::text[],
      array['line_set', 'refrigerant', 'cable_wire']::text[],
      '4_to_8h'
    ),
    -- Matching-wait demo: READY enrichment + DISPATCH_PENDING (first batch not opened yet).
    (
      'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid,
      '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63'::uuid,
      'acd13138-0d54-431f-a672-55903f31301e'::uuid,
      'Instalação de 2 Ar Condicionados (24.000 e 9.000 BTUs) com Ponto Elétrico',
      'Preciso de orçamento para instalação de 2 aparelhos de ar condicionado em minha residência. Um dos aparelhos é de 24.000 BTUs e o outro de 9.000 BTUs. Ainda não há ponto elétrico nos locais, então será necessário puxar fiação do contador geral e passá-la por dentro das paredes dos quartos até os pontos de instalação. A urgência é alta e prefiro o período da manhã para o serviço.',
      '{"urgency":"high","descricao":"Preciso instalar 2 ar condicionados, 1 de 24 mil btus e outro de 9 mil bts. ainda não tem ponto eletrico entao vai ter que puxar do contador geral um fio e psasar por dentro da parede dos quartos ate o local","tipo_imovel":"residencial","ja_tem_ponto":false,"tipo_servico":"instalacao_nova","qtd_aparelhos":2,"capacidade_btu":"24000","horario_preferido":"manha"}'::jsonb,
      'OPEN', 'high', 'medium',
      array['residencial', 'instalação nova', 'urgente', 'elétrica'],
      array['Qual a data preferida para o serviço?'],
      array['wire_strippers', 'voltage_tester', 'multimeter', 'cable_cutter', 'level', 'measuring_tape', 'drill', 'hammer_drill', 'ladder', 'extension_cord', 'work_light']::text[],
      array['cable_wire', 'conduit', 'junction_boxes', 'breakers', 'electrical_tape', 'screws', 'sealant', 'wire_nuts', 'pipe_cement']::text[],
      '4_to_8h'
    )
) as d(
  id, client_id, service_id, address_id, title, description, form_data,
  status, urgency, scope_complexity, tags, missing_info_warnings,
  suggested_equipment, suggested_materials, estimated_duration_hint
)
join public.platform_services ps on ps.id = d.service_id
join public.platform_forms pf on pf.id = ps.form_id
on conflict (id) do nothing;

-- 11b) service_request photos (storage paths in bucket service-requests)
--      Files are uploaded by: yarn seed:dev-images (see supabase/scripts/seed-dev-images.manifest.mjs)
update public.service_requests
set photos = array[
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_0.jpg',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_1.jpg'
]::text[]
where id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid;

update public.service_requests
set photos = array[
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_0.jpg',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_1.jpg'
]::text[]
where id = '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid;

update public.service_requests
set photos = array[
  '38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_0.jpg',
  '38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_1.jpg',
  '38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000201_2.jpg'
]::text[]
where id = '8017e002-5a32-44e7-b8da-1727a14f4d02'::uuid;

update public.service_requests
set photos = array['48e30f1d-3c47-441f-94c6-76b6ea0db472/1719000301_0.jpg']::text[]
where id = '8017e003-5a32-44e7-b8da-1727a14f4d03'::uuid;

update public.service_requests
set photos = array[
  '58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_0.jpg',
  '58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000401_1.jpg'
]::text[]
where id = '8017e004-5a32-44e7-b8da-1727a14f4d04'::uuid;

update public.service_requests
set photos = array[
  '68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_0.jpg',
  '68e30f1d-3c47-441f-94c6-76b6ea0db474/1719000501_1.jpg'
]::text[]
where id = '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid;

update public.service_requests
set photos = array['28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000601_0.jpg']::text[]
where id = '8017e006-5a32-44e7-b8da-1727a14f4d06'::uuid;

update public.service_requests
set photos = array[
  '38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_0.jpg',
  '38e30f1d-3c47-441f-94c6-76b6ea0db471/1719000701_1.jpg'
]::text[]
where id = '8017e007-5a32-44e7-b8da-1727a14f4d07'::uuid;

update public.service_requests
set photos = array[
  '58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_0.jpg',
  '58e30f1d-3c47-441f-94c6-76b6ea0db473/1719000901_1.jpg'
]::text[]
where id = '8017e009-5a32-44e7-b8da-1727a14f4d09'::uuid;

update public.service_requests
set photos = array[
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_0.jpg',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719001401_1.jpg'
]::text[]
where id = '8017e014-5a32-44e7-b8da-1727a14f4d14'::uuid;

update public.service_requests
set photos = array[
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_0.jpg',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000001_1.jpg',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470/1719000101_0.jpg'
]::text[]
where id = 'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid;

-- 12) Negotiation flows via RPCs (chats, messages, proposals)
create or replace function pg_temp.seed_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.seed_msg_key(p_scenario int, p_index int)
returns uuid
language sql
immutable
as $$
  select (
    lpad((90000000 + p_scenario)::text, 8, '0') || '-0001-4001-8001-' ||
    lpad((p_scenario * 100 + p_index)::text, 12, '0')
  )::uuid;
$$;

create or replace function pg_temp.seed_flow_key(p_scenario int, p_suffix int)
returns uuid
language sql
immutable
as $$
  select (
    lpad((91000000 + p_scenario)::text, 8, '0') || '-0001-4001-8001-' ||
    lpad((p_scenario * 100 + p_suffix)::text, 12, '0')
  )::uuid;
$$;

-- 13) Provider gateway account (NetCred)
-- Bootstrap trigger may already have inserted PENDING_DOCUMENTS; replace with ACTIVE seed state.
-- PENDING → ACTIVE is not an allowed FSM transition, so delete then insert.
DELETE FROM "public"."provider_gateway_accounts"
WHERE "provider_id" = '5d09e025-20a2-4842-aeef-324d42a431e1'
  AND "gateway_slug" = 'netcred';

INSERT INTO "public"."provider_gateway_accounts" ("id", "provider_id", "gateway_slug", "document", "netcred_company_id", "netcred_bank_account_id", "onboarding_status", "onboarding_submitted_at", "onboarding_activated_at", "email_dispatched_at", "created_at", "updated_at") VALUES ('24e5c730-6728-4eb9-a2e4-7cfc2c52355b', '5d09e025-20a2-4842-aeef-324d42a431e1', 'netcred', '49769985000103', '1048', '2053', 'ACTIVE', '2026-07-07 17:57:17+00', '2026-07-07 17:57:19+00', '2026-07-07 17:57:21+00', '2026-07-07 17:57:24.393658+00', '2026-07-07 17:57:24.393658+00');

-- Seed RPCs run in one transaction; now() is frozen so message order ties on UUID.
-- Re-stamp created_at in logical order (TEXT prelude, then PROPOSAL by version).
create or replace function pg_temp.seed_timeline_epoch()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-06-09 20:00:00+00';
$$;

create or replace function pg_temp.seed_finalize_chat_timeline(
  p_chat_id uuid,
  p_scenario int
)
returns void
language plpgsql
as $$
declare
  v_epoch timestamptz := pg_temp.seed_timeline_epoch();
begin
  with ranked as (
    select
      m.id,
      row_number() over (
        order by
          case m.message_type
            when 'TEXT'::public.cns_message_type then 1
            when 'PROPOSAL'::public.cns_message_type then 2
            else 3
          end,
          coalesce(pp.version, 0),
          coalesce(m.idempotency_key::text, m.id::text)
      ) as rn
    from public.chat_messages m
    left join public.provider_proposals pp
      on pp.id = m.linked_entity_id
      and m.message_type = 'PROPOSAL'::public.cns_message_type
    where m.chat_id = p_chat_id
  )
  update public.chat_messages m
  set created_at = v_epoch + make_interval(secs => p_scenario * 100 + ranked.rn)
  from ranked
  where m.id = ranked.id;

  update public.provider_proposals pp
  set
    created_at = m.created_at,
    submitted_at = m.created_at
  from public.chat_messages m
  where m.chat_id = p_chat_id
    and m.message_type = 'PROPOSAL'::public.cns_message_type
    and m.linked_entity_id = pp.id;

  update public.chats c
  set
    last_interaction_at = sub.max_created_at,
    updated_at = sub.max_created_at
  from (
    select max(cm.created_at) as max_created_at
    from public.chat_messages cm
    where cm.chat_id = p_chat_id
  ) sub
  where c.id = p_chat_id;
end;
$$;

create or replace function pg_temp.seed_chat_prelude(
  p_sr_id uuid,
  p_client_id uuid,
  p_provider_id uuid,
  p_scenario int
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
  v_response jsonb;
  v_provider_msgs text[] := array[
    'Olá! Vi seu pedido e posso ajudar.',
    'Qual o melhor horário para uma visita técnica?',
    'Preciso confirmar se há espaço no quadro elétrico.',
    'Consigo levar material básico no dia do serviço.',
    'Posso enviar o orçamento detalhado em seguida.'
  ];
  v_client_msgs text[] := array[
    'Oi! Obrigado pelo retorno.',
    'Prefiro horário de manhã, se possível.',
    'Sim, o quadro foi reformado há 2 anos.',
    'Pode incluir material no orçamento.',
    'Aguardo a proposta formal, por favor.'
  ];
  i int;
begin
  perform pg_temp.seed_set_auth(p_provider_id);
  v_response := public.cns_send_message(
    'TEXT'::public.cns_message_type,
    pg_temp.seed_msg_key(p_scenario, 1),
    jsonb_build_object('text', v_provider_msgs[1]),
    null,
    p_sr_id
  );
  v_chat_id := (v_response->'conversation'->>'id')::uuid;

  for i in 1..4 loop
    perform pg_temp.seed_set_auth(p_client_id);
    perform public.cns_send_message(
      'TEXT'::public.cns_message_type,
      pg_temp.seed_msg_key(p_scenario, i * 2),
      jsonb_build_object('text', v_client_msgs[i]),
      v_chat_id,
      null
    );

    perform pg_temp.seed_set_auth(p_provider_id);
    perform public.cns_send_message(
      'TEXT'::public.cns_message_type,
      pg_temp.seed_msg_key(p_scenario, i * 2 + 1),
      jsonb_build_object('text', v_provider_msgs[i + 1]),
      v_chat_id,
      null
    );
  end loop;

  perform pg_temp.seed_set_auth(p_client_id);
  perform public.cns_send_message(
    'TEXT'::public.cns_message_type,
    pg_temp.seed_msg_key(p_scenario, 10),
    jsonb_build_object('text', v_client_msgs[5]),
    v_chat_id,
    null
  );

  return v_chat_id;
end;
$$;

create or replace function pg_temp.seed_create_proposal(
  p_sr_id uuid,
  p_provider_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_description text default 'Proposta conforme alinhado no chat.'
)
returns jsonb
language plpgsql
as $$
declare
  v_response jsonb;
begin
  perform pg_temp.seed_set_auth(p_provider_id);

  with pricing as (
    select *
    from public.calculate_provider_service_pricing(p_amount)
  )
  select public.create_provider_proposal(
    p_sr_id,
    p_idempotency_key,
    pricing.original_amount,
    p_description,
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', (current_date + 2)::text,
        'shift', 'morning'
      )
    ),
    '{}'::text[],
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature
  )
  into v_response
  from pricing;

  return v_response;
end;
$$;

do $seed_negotiations$
declare
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1';
  v_client_id uuid := '28e30f1d-3c47-441f-94c6-76b6ea0db470';
  v_chat_id uuid;
  v_proposal jsonb;
  v_proposal_id uuid;
begin
  -- 1) Proposal rejected by client (8017e001)
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid,
    v_client_id,
    v_provider_id,
    1
  );
  v_proposal := pg_temp.seed_create_proposal(
    '8017e001-5a32-44e7-b8da-1727a14f4d01'::uuid,
    v_provider_id,
    450.00,
    pg_temp.seed_flow_key(1, 1)
  );
  perform pg_temp.seed_set_auth(v_client_id);
  perform public.reject_proposal(
    (v_proposal->'proposal'->>'id')::uuid,
    pg_temp.seed_flow_key(1, 2),
    'Valor acima do orçamento disponível.'
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 1);

  -- 2) Proposal pending client response (8017e002)
  v_client_id := '38e30f1d-3c47-441f-94c6-76b6ea0db471';
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e002-5a32-44e7-b8da-1727a14f4d02'::uuid,
    v_client_id,
    v_provider_id,
    2
  );
  perform pg_temp.seed_create_proposal(
    '8017e002-5a32-44e7-b8da-1727a14f4d02'::uuid,
    v_provider_id,
    890.00,
    pg_temp.seed_flow_key(2, 1)
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 2);

  -- 3) Proposal pending client response (8017e003)
  v_client_id := '48e30f1d-3c47-441f-94c6-76b6ea0db472';
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e003-5a32-44e7-b8da-1727a14f4d03'::uuid,
    v_client_id,
    v_provider_id,
    3
  );
  perform pg_temp.seed_create_proposal(
    '8017e003-5a32-44e7-b8da-1727a14f4d03'::uuid,
    v_provider_id,
    620.00,
    pg_temp.seed_flow_key(3, 1)
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 3);

  -- 4) Revision requested by client (8017e004)
  v_client_id := '58e30f1d-3c47-441f-94c6-76b6ea0db473';
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e004-5a32-44e7-b8da-1727a14f4d04'::uuid,
    v_client_id,
    v_provider_id,
    4
  );
  v_proposal := pg_temp.seed_create_proposal(
    '8017e004-5a32-44e7-b8da-1727a14f4d04'::uuid,
    v_provider_id,
    1250.00,
    pg_temp.seed_flow_key(4, 1)
  );
  perform pg_temp.seed_set_auth(v_client_id);
  perform public.request_proposal_revision(
    (v_proposal->'proposal'->>'id')::uuid,
    pg_temp.seed_flow_key(4, 2),
    'REDUCE_SCOPE'::public.proposal_revision_reason,
    'Por favor, remover instalação do rack e manter apenas o split.'
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 4);

  -- 5) Revised proposal after client revision request (8017e005)
  v_client_id := '68e30f1d-3c47-441f-94c6-76b6ea0db474';
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid,
    v_client_id,
    v_provider_id,
    5
  );
  v_proposal := pg_temp.seed_create_proposal(
    '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid,
    v_provider_id,
    780.00,
    pg_temp.seed_flow_key(5, 1)
  );
  perform pg_temp.seed_set_auth(v_client_id);
  perform public.request_proposal_revision(
    (v_proposal->'proposal'->>'id')::uuid,
    pg_temp.seed_flow_key(5, 2),
    'PRICE_TOO_HIGH'::public.proposal_revision_reason,
    'Consegue reduzir o valor incluindo apenas material básico?'
  );
  perform pg_temp.seed_create_proposal(
    '8017e005-5a32-44e7-b8da-1727a14f4d05'::uuid,
    v_provider_id,
    690.00,
    pg_temp.seed_flow_key(5, 3),
    'Proposta revisada com escopo reduzido e material básico.'
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 5);

  -- 6-10) Discovery chats without proposals yet
  perform pg_temp.seed_chat_prelude(
    '8017e006-5a32-44e7-b8da-1727a14f4d06'::uuid,
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    v_provider_id,
    6
  );
  perform pg_temp.seed_finalize_chat_timeline(
    (select id from public.chats where service_request_id = '8017e006-5a32-44e7-b8da-1727a14f4d06'::uuid limit 1),
    6
  );
  perform pg_temp.seed_chat_prelude(
    '8017e007-5a32-44e7-b8da-1727a14f4d07'::uuid,
    '38e30f1d-3c47-441f-94c6-76b6ea0db471'::uuid,
    v_provider_id,
    7
  );
  perform pg_temp.seed_finalize_chat_timeline(
    (select id from public.chats where service_request_id = '8017e007-5a32-44e7-b8da-1727a14f4d07'::uuid limit 1),
    7
  );
  perform pg_temp.seed_chat_prelude(
    '8017e008-5a32-44e7-b8da-1727a14f4d08'::uuid,
    '48e30f1d-3c47-441f-94c6-76b6ea0db472'::uuid,
    v_provider_id,
    8
  );
  perform pg_temp.seed_finalize_chat_timeline(
    (select id from public.chats where service_request_id = '8017e008-5a32-44e7-b8da-1727a14f4d08'::uuid limit 1),
    8
  );
  perform pg_temp.seed_chat_prelude(
    '8017e009-5a32-44e7-b8da-1727a14f4d09'::uuid,
    '58e30f1d-3c47-441f-94c6-76b6ea0db473'::uuid,
    v_provider_id,
    9
  );
  perform pg_temp.seed_finalize_chat_timeline(
    (select id from public.chats where service_request_id = '8017e009-5a32-44e7-b8da-1727a14f4d09'::uuid limit 1),
    9
  );
  v_chat_id := pg_temp.seed_chat_prelude(
    '8017e00a-5a32-44e7-b8da-1727a14f4d0a'::uuid,
    '68e30f1d-3c47-441f-94c6-76b6ea0db474'::uuid,
    v_provider_id,
    10
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 10);

  -- Cancel after provider-led discovery chat, before any proposal (8017e018)
  v_client_id := '68e30f1d-3c47-441f-94c6-76b6ea0db474';
  perform pg_temp.seed_chat_prelude(
    '8017e018-5a32-44e7-b8da-1727a14f4d18'::uuid,
    v_client_id,
    v_provider_id,
    18
  );
  perform pg_temp.seed_set_auth(v_client_id);
  perform public.cancel_service_request(
    '8017e018-5a32-44e7-b8da-1727a14f4d18'::uuid,
    pg_temp.seed_flow_key(18, 1)
  );
  perform pg_temp.seed_finalize_chat_timeline(v_chat_id, 18);
end;
$seed_negotiations$;

-- 11c) Completion enrichments + matching dispatch bootstrap (OPEN trigger removed).
-- Matching only bootstraps when enrichment = READY. Seed inserts READY rows and
-- DISPATCH_PENDING directly (matching_bootstrap RPC requires service_role JWT).
insert into public.service_request_enrichments (
  id,
  service_request_id,
  status,
  checklist_schema,
  source,
  materialized_at,
  schema_version,
  attempt_count,
  lease_generation
)
select
  case
    when sr.id = 'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid
      then 'f8875581-2751-467c-ba84-60de3b099df0'::uuid
    else md5('seed-enrichment:' || sr.id::text)::uuid
  end,
  sr.id,
  'READY'::public.enrichment_status,
  case
    when sr.id = 'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid then
      '{
        "blocks": [
          {
            "id": "trabalho_executado_corretamente",
            "type": "completion_criterion",
            "label": "O serviço de instalação dos dois aparelhos de ar condicionado foi concluído com sucesso?",
            "config": {"evidence_max": 3, "evidence_min": 1, "requires_evidence_when_met": true},
            "helpText": "Confirme se ambos os aparelhos foram instalados e estão funcionando.",
            "required": true
          },
          {
            "id": "ponto_eletrico_criado",
            "type": "completion_criterion",
            "label": "Os pontos elétricos necessários foram criados e instalados corretamente?",
            "config": {"evidence_max": 3, "evidence_min": 1, "requires_evidence_when_met": true},
            "helpText": "Verifique se a fiação foi passada do contador geral até os locais de instalação e se os pontos elétricos estão seguros.",
            "required": true
          },
          {
            "id": "fiao_passada_parede",
            "type": "completion_criterion",
            "label": "A fiação foi passada por dentro das paredes conforme solicitado?",
            "config": {"evidence_max": 3, "evidence_min": 1, "requires_evidence_when_met": true},
            "helpText": "Confirme se a passagem da fiação foi feita de forma limpa e segura dentro das paredes.",
            "required": true
          },
          {
            "id": "limpeza_organizacao",
            "type": "completion_criterion",
            "label": "O local de trabalho foi deixado limpo e organizado após o serviço?",
            "config": {"evidence_max": 2, "evidence_min": 1, "requires_evidence_when_met": false},
            "helpText": "O profissional deve recolher todo o material e lixo gerado durante a instalação.",
            "required": true
          },
          {
            "id": "horario_cumprido",
            "type": "completion_criterion",
            "label": "O serviço foi realizado no período da manhã, conforme preferência?",
            "config": {"evidence_max": 2, "evidence_min": 1, "requires_evidence_when_met": false},
            "helpText": "Confirme se o profissional iniciou e concluiu o serviço no período da manhã.",
            "required": true
          },
          {
            "id": "funcionamento_aparelhos",
            "type": "completion_criterion",
            "label": "Ambos os aparelhos de ar condicionado (24.000 e 9.000 BTUs) estão funcionando corretamente?",
            "config": {"evidence_max": 3, "evidence_min": 1, "requires_evidence_when_met": true},
            "helpText": "Teste ambos os aparelhos para garantir que estão gelando e sem ruídos estranhos.",
            "required": true
          },
          {
            "id": "seguranca_instalacao",
            "type": "completion_criterion",
            "label": "A instalação elétrica e dos aparelhos está segura e de acordo com as normas?",
            "config": {"evidence_max": 3, "evidence_min": 1, "requires_evidence_when_met": true},
            "helpText": "Verifique se as conexões estão bem feitas e se não há riscos de curto-circuito ou queda dos aparelhos.",
            "required": true
          }
        ],
        "version": 1
      }'::jsonb
    else tpl.checklist_schema
  end,
  case
    when sr.id = 'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid
      then 'ai'::public.checklist_source
    else 'fallback_template'::public.checklist_source
  end,
  now(),
  coalesce(tpl.schema_version, 1),
  0,
  0
from public.service_requests sr
cross join lateral (
  select t.checklist_schema, t.schema_version
  from public.completion_checklist_templates t
  where t.is_global and t.is_active
  order by t.id
  limit 1
) tpl
where sr.status = 'OPEN'::public.service_request_status
on conflict (service_request_id) do nothing;

insert into public.service_request_dispatches (
  service_request_id,
  status,
  next_batch_at
)
select
  sr.id,
  'DISPATCH_PENDING'::public.service_request_dispatch_status,
  case
    -- Demo SR waits for first matching batch (default start delay).
    when sr.id = 'eb207b54-6261-45df-8b6a-8117a0aaa57b'::uuid
      then now() + interval '5 minutes'
    -- Other OPEN seeds are due immediately so local feed/batch can open on first cron tick.
    else now()
  end
from public.service_requests sr
where sr.status = 'OPEN'::public.service_request_status
on conflict (service_request_id) do nothing;

insert into public.service_request_dispatch_events (
  dispatch_id,
  service_request_id,
  event_type,
  payload
)
select
  d.id,
  d.service_request_id,
  'state_transition'::public.service_request_dispatch_event_type,
  jsonb_build_object('bootstrap', true, 'to', 'DISPATCH_PENDING', 'seed', true)
from public.service_request_dispatches d
join public.service_requests sr on sr.id = d.service_request_id
where sr.status = 'OPEN'::public.service_request_status
  and not exists (
    select 1
    from public.service_request_dispatch_events e
    where e.dispatch_id = d.id
      and e.event_type = 'state_transition'::public.service_request_dispatch_event_type
  );

-- Message Dispatcher templates
insert into message_dispatcher.message_templates (
  template_key,
  channel,
  subject_template,
  body_template,
  variable_schema,
  active
)
values
  (
    'welcome_template',
    'email',
    'Welcome to Renovi, {{name}}!',
    '<p>Hello {{name}}, welcome to Renovi.</p>{{#coupon}}<p>Your coupon: {{coupon}}</p>{{/coupon}}',
    '{
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "coupon": { "type": "string" }
      },
      "required": ["name"],
      "additionalProperties": false
    }'::jsonb,
    true
  ),
  (
    'engagement_push',
    'push',
    '{{headline}}',
    '{{name}} — {{body}}',
    '{
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "headline": { "type": "string" },
        "body": { "type": "string" },
        "deep_link": { "type": "string" }
      },
      "required": ["name", "headline", "body"],
      "additionalProperties": false
    }'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;

-- Seed chat/proposal flows enqueue MMD notifications; cancel pending rows so pgTAP
-- dispatcher tests start with an empty checkout poll queue.
update message_dispatcher.message_dispatches d
set
  status = 'CANCELED'::message_dispatcher.message_dispatch_status,
  cancel_reason = 'seed_cleanup',
  locked_until = null,
  locked_by = null,
  updated_at = now()
where d.status in (
  'PENDING_EVALUATION'::message_dispatcher.message_dispatch_status,
  'SCHEDULED'::message_dispatcher.message_dispatch_status,
  'QUEUED'::message_dispatcher.message_dispatch_status,
  'PROCESSING'::message_dispatcher.message_dispatch_status,
  'FAILED_RETRYABLE'::message_dispatcher.message_dispatch_status
);

-- Atualizar taxas de cartão de crédito (sandbox NetCred)
UPDATE public.platform_constants SET value = '3.10'::jsonb WHERE key = 'cc_visa_master_1x_rate';
UPDATE public.platform_constants SET value = '3.80'::jsonb WHERE key = 'cc_visa_master_2_6x_rate';
UPDATE public.platform_constants SET value = '4.80'::jsonb WHERE key = 'cc_visa_master_7_12x_rate';
UPDATE public.platform_constants SET value = '3.80'::jsonb WHERE key = 'cc_elo_other_1x_rate';
UPDATE public.platform_constants SET value = '4.20'::jsonb WHERE key = 'cc_elo_other_2_6x_rate';
UPDATE public.platform_constants SET value = '5.20'::jsonb WHERE key = 'cc_elo_other_7_12x_rate';
UPDATE public.platform_constants SET value = '4.90'::jsonb WHERE key = 'cc_fixed_processing_fee_brl';
-- Sandbox RISK_ANALYSIS temporarily set to R$5 (prod target remains R$0.49 in migration seed)
UPDATE public.platform_constants SET value = '5.00'::jsonb WHERE key = 'cc_risk_analysis_fee_brl';
