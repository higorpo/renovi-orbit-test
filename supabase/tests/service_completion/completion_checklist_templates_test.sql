-- pgTAP: service-completion Task 5 — template XOR + active uniqueness + global seed.

begin;

select plan(5);

select ok(
  to_regclass('public.completion_checklist_templates') is not null,
  'completion_checklist_templates table exists'
);

select ok(
  exists (
    select 1
    from public.completion_checklist_templates
    where is_global
      and is_active
  ),
  'active global checklist template is seeded'
);

select throws_ok(
  $sql$
    insert into public.completion_checklist_templates (
      is_global, checklist_schema
    ) values (
      true,
      '{"version":1,"blocks":[]}'::jsonb
    )
  $sql$,
  '23505',
  null,
  'second active global template rejected by uq_template_active_global'
);

select throws_ok(
  $sql$
    insert into public.completion_checklist_templates (
      is_global,
      platform_service_id,
      checklist_schema
    ) values (
      true,
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a61'::uuid,
      '{"version":1,"blocks":[]}'::jsonb
    )
  $sql$,
  '23514',
  null,
  'XOR scope CHECK rejects global + platform_service_id together'
);

select ok(
  not has_table_privilege('authenticated', 'public.completion_checklist_templates', 'INSERT')
    and not has_table_privilege('authenticated', 'public.completion_checklist_templates', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.completion_checklist_templates', 'DELETE'),
  'authenticated cannot write completion_checklist_templates'
);

select finish();

rollback;
