-- pgTAP: matching.new_opportunity MMD templates (matching M11a).

begin;

select plan(4);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'matching.new_opportunity'
      and mt.channel = 'push'
      and mt.active = true
      and mt.body_template like '%{{title}}%'
  ),
  'matching.new_opportunity push template is active'
);

select ok(
  exists (
    select 1
    from message_dispatcher.message_templates mt
    where mt.template_key = 'matching.new_opportunity'
      and mt.channel = 'email'
      and mt.active = true
      and mt.subject_template like '%{{title}}%'
  ),
  'matching.new_opportunity email template is active'
);

select ok(
  (
    select mt.variable_schema -> 'required'
    from message_dispatcher.message_templates mt
    where mt.template_key = 'matching.new_opportunity'
      and mt.channel = 'push'
  ) @> '[
    "service_request_id",
    "title",
    "service_name",
    "neighborhood",
    "urgency",
    "deep_link_path"
  ]'::jsonb,
  'push variable_schema requires matching notification fields'
);

select ok(
  not (
    select coalesce(mt.variable_schema -> 'properties' ? 'distance_km', false)
    from message_dispatcher.message_templates mt
    where mt.template_key = 'matching.new_opportunity'
      and mt.channel = 'email'
  ),
  'email variable_schema excludes distance_km'
);

select finish();

rollback;
