-- pgTAP: MVP message_templates seeds (task 18).

begin;

select plan(4);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates
    where template_key = 'welcome_template'
      and channel = 'email'
      and active = true
      and variable_schema <> '{}'::jsonb
      and subject_template is not null
  ),
  'welcome_template email row'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates
    where template_key = 'engagement_push'
      and channel = 'push'
      and active = true
      and variable_schema <> '{}'::jsonb
      and body_template is not null
  ),
  'engagement_push push row'
);

select ok(
  (
    select variable_schema -> 'required'
    from message_dispatcher.message_templates
    where template_key = 'welcome_template' and channel = 'email'
  ) @> '["name"]'::jsonb,
  'welcome_template requires name'
);

select ok(
  (
    select variable_schema -> 'required'
    from message_dispatcher.message_templates
    where template_key = 'engagement_push' and channel = 'push'
  ) @> '["name", "headline", "body"]'::jsonb,
  'engagement_push requires name headline body'
);

select finish();

rollback;
