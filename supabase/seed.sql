-- Seed data for local development and db reset.
-- Covers platform geography (states, cities, neighborhoods), platform_forms, platform_services, platform_ai_prompts,
-- and two test users (client + provider) with all related table data populated.
--
-- Test accounts (password: Abc123):
--   client:   cliente@renovi.com.br
--   provider: prestador@renovi.com.br

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
-- client:   cliente@renovi.com.br  / Abc123
-- provider: prestador@renovi.com.br / Abc123
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
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    'authenticated', 'authenticated',
    'prestador@renovi.com.br',
    crypt('Abc123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"João Eletricista","role":"provider"}'::jsonb,
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
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    '{"sub":"5d09e025-20a2-4842-aeef-324d42a431e1","email":"prestador@renovi.com.br"}'::jsonb,
    'email',
    '5d09e025-20a2-4842-aeef-324d42a431e1',
    now(), now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- 3) Enrich profiles with phone
update public.profiles
set phone = '(48) 99123-4567'
where id = '28e30f1d-3c47-441f-94c6-76b6ea0db470' and phone is null;

update public.profiles
set phone = '(48) 98765-4321'
where id = '5d09e025-20a2-4842-aeef-324d42a431e1' and phone is null;

-- 4) client_profiles_private (CPF)
update public.client_profiles_private
set cpf = '123.456.789-00'
where client_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470' and cpf is null;

-- 5) provider_profiles_private (entity + CPF)
update public.provider_profiles_private
set entity_type = 'pf',
    cpf = '987.654.321-00'
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1' and cpf is null;

-- 6) provider_profiles_public (slug, display_name, bio, visibility)
update public.provider_profiles_public
set slug = 'joao-eletricista',
    display_name = 'João Eletricista',
    bio = 'Eletricista profissional com mais de 10 anos de experiência em instalações residenciais e comerciais. Especialista em instalação elétrica, manutenção preventiva e instalação de ar condicionado. Atendo toda a região de Florianópolis.',
    profile_visibility = 'public'
where provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1';

-- 7) client_addresses (one address in Florianópolis - Centro)
insert into public.client_addresses (
  id, client_id, label, street, number, complement,
  neighborhood, zip_code, state_id, city_id,
  is_default, is_active, location
)
values (
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
  ST_SetSRID(ST_MakePoint(-48.5482, -27.5954), 4326)::geography
)
on conflict (id) do nothing;

-- 8) provider_offered_services
insert into public.provider_offered_services (provider_id, service_id, sort_order)
values
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62', 0),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a63', 1)
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
  )
on conflict (id) do nothing;

-- 10) provider_service_area_neighborhoods (Florianópolis: Centro, Trindade, Agronômica)
insert into public.provider_service_area_neighborhoods (provider_id, neighborhood_id)
values
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a31'),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32'),
  ('5d09e025-20a2-4842-aeef-324d42a431e1', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a34')
on conflict (provider_id, neighborhood_id) do nothing;

-- 11) service_request from client (for testing flows)
insert into public.service_requests (
  id, client_id, service_id, address_id,
  title, description, form_data, form_version,
  status, urgency
)
values (
  '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a62'::uuid,
  'acd13138-0d54-431f-a672-55903f31301e'::uuid,
  'Instalação elétrica - 5 pontos novos',
  'Preciso instalar 5 pontos de tomada novos na sala e cozinha. A casa é antiga e não tem aterramento.',
  '{
    "tipo_servico": "nova",
    "tipo_imovel": "residencial",
    "urgency": "medium",
    "qtd_pontos": 5,
    "aterramento": true,
    "descricao": "Preciso instalar 5 pontos de tomada novos na sala e cozinha. A casa é antiga e não tem aterramento."
  }'::jsonb,
  '2.0',
  'OPEN',
  'medium'
)
on conflict (id) do nothing;

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