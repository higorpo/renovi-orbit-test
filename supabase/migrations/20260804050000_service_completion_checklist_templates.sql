-- Service completion Task 5: completion_checklist_templates + global seed (design §3.4, decision 19).
-- category_id references platform_services: Orbit has no service_categories table;
-- category = parent/root node in the platform_services tree (parent_id hierarchy).
--
-- Full schema validation via enrichment_validate_checklist_schema lands in 041900;
-- this migration only enforces a minimal structural CHECK (blocks key present).

create table public.completion_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  platform_service_id uuid references public.platform_services (id),
  category_id uuid references public.platform_services (id),
  is_global boolean not null default false,
  checklist_schema jsonb not null,
  schema_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_scope_xor check (
    (
      (platform_service_id is not null)::int
      + (category_id is not null)::int
      + (is_global)::int
    ) = 1
  ),
  -- Structural only: enrichment_validate_checklist_schema is created later (041900).
  constraint template_checklist_schema_has_blocks check (
    checklist_schema ? 'blocks'
    and jsonb_typeof(checklist_schema->'blocks') = 'array'
  )
);

comment on table public.completion_checklist_templates is
  'Fallback catalog. Resolve: platform_service → category → global (decision 19).';
comment on column public.completion_checklist_templates.category_id is
  'Catalog category = parent platform_services row (no separate service_categories table).';
comment on column public.completion_checklist_templates.is_global is
  'When true, template is the global default; XOR with platform_service_id/category_id.';
comment on constraint template_checklist_schema_has_blocks
  on public.completion_checklist_templates is
  'Minimal structural guard (blocks array). Full Dynamic Form validation is in 041900 RPCs.';

create unique index uq_template_active_service
  on public.completion_checklist_templates (platform_service_id)
  where is_active and platform_service_id is not null;

create unique index uq_template_active_category
  on public.completion_checklist_templates (category_id)
  where is_active and category_id is not null;

create unique index uq_template_active_global
  on public.completion_checklist_templates ((is_global))
  where is_active and is_global;

create trigger completion_checklist_templates_updated_at
  before update on public.completion_checklist_templates
  for each row
  execute procedure public.set_updated_at();

-- Clients must not write templates; mutations via service_role / ops only.
revoke insert, update, delete, truncate on table public.completion_checklist_templates from public;
revoke insert, update, delete, truncate on table public.completion_checklist_templates from anon;
revoke insert, update, delete, truncate on table public.completion_checklist_templates from authenticated;

-- Global fallback seed (design §3.4 minimal valid schema: 3 criteria + static_text).
insert into public.completion_checklist_templates (
  is_global,
  schema_version,
  is_active,
  checklist_schema
)
values (
  true,
  1,
  true,
  $schema${
    "version": 1,
    "blocks": [
      {
        "id": "crit_work_done",
        "type": "completion_criterion",
        "label": "O serviço combinado foi executado conforme o pedido?",
        "required": true,
        "config": {
          "requires_evidence_when_met": true,
          "evidence_min": 1,
          "evidence_max": 5
        }
      },
      {
        "id": "crit_area_clean",
        "type": "completion_criterion",
        "label": "A área de trabalho ficou limpa e organizada?",
        "required": true,
        "config": {
          "requires_evidence_when_met": false,
          "evidence_min": 1,
          "evidence_max": 5
        }
      },
      {
        "id": "crit_client_access",
        "type": "completion_criterion",
        "label": "Acesso e horários combinados foram respeitados?",
        "required": true,
        "config": {
          "requires_evidence_when_met": false,
          "evidence_min": 1,
          "evidence_max": 5
        },
        "helpText": "Se não, explique e anexe evidência."
      },
      {
        "id": "static_hint",
        "type": "static_text",
        "content": "Responda cada critério. Fotos são obrigatórias quando o critério não foi atendido."
      }
    ]
  }$schema$::jsonb
);
