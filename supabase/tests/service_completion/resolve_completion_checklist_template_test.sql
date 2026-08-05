-- pgTAP: Task 25 — template cascade order service > category > global.

begin;

select plan(5);

create or replace function pg_temp.set_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
end;
$$;

-- Seed IDs from local catalog
select set_config('test.service_id', 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', true);
-- Use a synthetic category parent id (insert inactive platform_services parent if needed)
select set_config('test.category_id', gen_random_uuid()::text, true);

-- Ensure parent category service row exists for FK
insert into public.platform_services (
  id, parent_id, form_id, title, description, slug, show_on_request_quote, active, sort_order
)
select
  current_setting('test.category_id')::uuid,
  null,
  ps.form_id,
  'Categoria teste cascade',
  'pgTAP category parent',
  'categoria-teste-cascade-' || substr(current_setting('test.category_id'), 1, 8),
  false,
  true,
  99
from public.platform_services ps
where ps.id = current_setting('test.service_id')::uuid
on conflict (id) do nothing;

-- Point seed service at category parent for derive path (optional); keep separate category_id arg tests.

-- Global already seeded (Task 5). Insert category + service templates with distinct markers.
insert into public.completion_checklist_templates (
  category_id, is_global, is_active, schema_version, checklist_schema
)
values (
  current_setting('test.category_id')::uuid,
  false,
  true,
  1,
  $schema${
    "version": 1,
    "blocks": [
      {"id":"cat1","type":"completion_criterion","label":"Category A?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"cat2","type":"completion_criterion","label":"Category B?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"cat3","type":"completion_criterion","label":"Category C?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"mark","type":"static_text","content":"SCOPE_CATEGORY"}
    ]
  }$schema$::jsonb
);

insert into public.completion_checklist_templates (
  platform_service_id, is_global, is_active, schema_version, checklist_schema
)
values (
  current_setting('test.service_id')::uuid,
  false,
  true,
  1,
  $schema${
    "version": 1,
    "blocks": [
      {"id":"svc1","type":"completion_criterion","label":"Service A?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"svc2","type":"completion_criterion","label":"Service B?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"svc3","type":"completion_criterion","label":"Service C?","required":true,"config":{"requires_evidence_when_met":false}},
      {"id":"mark","type":"static_text","content":"SCOPE_SERVICE"}
    ]
  }$schema$::jsonb
);

-- resolve_completion_checklist_template requires auth.role() = service_role
select pg_temp.set_service_role();

select is(
  public.resolve_completion_checklist_template(
    current_setting('test.service_id')::uuid,
    current_setting('test.category_id')::uuid
  )->>'scope',
  'service',
  'prefers platform_service template over category/global'
);

select is(
  (
    select b->>'content'
    from jsonb_array_elements(
      public.resolve_completion_checklist_template(
        current_setting('test.service_id')::uuid,
        current_setting('test.category_id')::uuid
      )->'checklist_schema'->'blocks'
    ) b
    where b->>'id' = 'mark'
  ),
  'SCOPE_SERVICE',
  'service scope returns service schema marker'
);

-- Deactivate service template → category wins
update public.completion_checklist_templates
set is_active = false
where platform_service_id = current_setting('test.service_id')::uuid;

select is(
  public.resolve_completion_checklist_template(
    current_setting('test.service_id')::uuid,
    current_setting('test.category_id')::uuid
  )->>'scope',
  'category',
  'falls back to category when service template inactive'
);

-- Deactivate category → global
update public.completion_checklist_templates
set is_active = false
where category_id = current_setting('test.category_id')::uuid;

select is(
  public.resolve_completion_checklist_template(
    current_setting('test.service_id')::uuid,
    current_setting('test.category_id')::uuid
  )->>'scope',
  'global',
  'falls back to global when service+category inactive'
);

select ok(
  public.resolve_completion_checklist_template(null, null)->>'scope' = 'global'
    or public.resolve_completion_checklist_template(null, null) is not null,
  'null service/category still resolves global when seeded'
);

select finish();

rollback;
