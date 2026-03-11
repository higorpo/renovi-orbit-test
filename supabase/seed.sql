-- Seed data for local development and db reset.
-- Covers platform geography (states, cities, neighborhoods), forms (default, instalacao eletrica, instalacao ar condicionado), services, and AI prompts.
-- Profiles, client_addresses, service_requests, rate_limits, ai_prompt_usage are not seeded (auth/user/analytics data).

-- ---------------------------------------------------------------------------
-- platform_states
-- ---------------------------------------------------------------------------
insert into public.platform_states (id, ibge_code, name, abbreviation, is_active)
values
  ('a1b2c3d4-e5f6-4789-a012-000000000001'::uuid, 42, 'Santa Catarina', 'SC', true),
  ('a1b2c3d4-e5f6-4789-a012-000000000002'::uuid, 35, 'São Paulo', 'SP', true)
on conflict (ibge_code) do nothing;

-- ---------------------------------------------------------------------------
-- platform_cities
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- platform_neighborhoods
-- ---------------------------------------------------------------------------
insert into public.platform_neighborhoods (id, city_id, name, is_active)
values
  ('c3d4e5f6-a7b8-4901-c234-000000000001'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Centro', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000002'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Trindade', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000003'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000001'::uuid, 'Lagoa da Conceição', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000004'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Sé', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000005'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Pinheiros', true),
  ('c3d4e5f6-a7b8-4901-c234-000000000006'::uuid, 'b2c3d4e5-f6a7-4890-b123-000000000002'::uuid, 'Vila Madalena', true)
on conflict (city_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- forms (default + instalacao eletrica + instalacao ar condicionado)
-- ---------------------------------------------------------------------------
insert into public.forms (id, form_schema, form_version, form_status, description)
values
  (
    'd4e5f6a7-b8c9-4012-d345-000000000001'::uuid,
    '{"version":"2.0","id":"default-form","title":"Formulário padrão","metadata":{"categorySlug":"servico-exemplo","categoryId":null,"status":"draft"},"config":{"showProgressBar":true},"steps":[]}'::jsonb,
    '2.0',
    'active',
    'Default seed form for local development'
  ),
  (
    'd4e5f6a7-b8c9-4012-d345-000000000002'::uuid,
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
    'd4e5f6a7-b8c9-4012-d345-000000000003'::uuid,
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
-- ai_prompts (default + instalacao eletrica for generate-smart-description)
-- Must run before services (services.ai_prompt_id references ai_prompts.id).
-- ---------------------------------------------------------------------------
insert into public.ai_prompts (
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
    'f6a7b8c9-d0e1-4234-f567-000000000001'::uuid,
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
    'f6a7b8c9-d0e1-4234-f567-000000000002'::uuid,
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
    'f6a7b8c9-d0e1-4234-f567-000000000003'::uuid,
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
-- services (default + instalacao eletrica + instalacao ar condicionado)
-- ---------------------------------------------------------------------------
insert into public.services (id, parent_id, form_id, title, description, slug, show_on_request_quote, active, sort_order, ai_prompt_id)
values
  (
    'e5f6a7b8-c9d0-4123-e456-000000000001'::uuid,
    null,
    'd4e5f6a7-b8c9-4012-d345-000000000001'::uuid,
    'Serviço exemplo',
    'Formulário de orçamento padrão para desenvolvimento local.',
    'servico-exemplo',
    true,
    true,
    0,
    null
  ),
  (
    'e5f6a7b8-c9d0-4123-e456-000000000002'::uuid,
    null,
    'd4e5f6a7-b8c9-4012-d345-000000000002'::uuid,
    'Instalação elétrica',
    'Orçamento para instalação, reforma ou manutenção elétrica residencial e comercial.',
    'instalacao-eletrica',
    true,
    true,
    1,
    'f6a7b8c9-d0e1-4234-f567-000000000002'::uuid
  ),
  (
    'e5f6a7b8-c9d0-4123-e456-000000000003'::uuid,
    null,
    'd4e5f6a7-b8c9-4012-d345-000000000003'::uuid,
    'Instalação de ar condicionado',
    'Orçamento para instalação nova, manutenção, limpeza ou troca de ar condicionado residencial e comercial.',
    'instalacao-ar-condicionado',
    true,
    true,
    2,
    'f6a7b8c9-d0e1-4234-f567-000000000003'::uuid
  )
on conflict (slug) do nothing;
