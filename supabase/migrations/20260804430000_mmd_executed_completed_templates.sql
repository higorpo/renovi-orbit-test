-- Service completion Task 43: extend SERVICE_EXECUTED / SERVICE_COMPLETED MMD templates + vars.
-- Confirm deep link for client; provider confirm copy includes rating context.
-- Lifecycle RPC bodies (mark_executed / confirm_with_rating) live in 043500 / 043600;
-- MMD payload deltas (rating_id, overall_score) are folded there.

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
    'service.service_executed',
    'push',
    'Confirme o recebimento — {{service_request_title}}',
    'O prestador marcou o serviço como executado. Revise o checklist e as evidências e confirme o recebimento.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"provider_id":{"type":"string"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  ),
  (
    'service.service_completed',
    'push',
    'Serviço concluído — {{service_request_title}}',
    'O cliente confirmou o recebimento e enviou a avaliação do serviço.',
    '{"type":"object","properties":{"service_id":{"type":"string"},"client_id":{"type":"string"},"provider_id":{"type":"string"},"completed_by":{"type":"string"},"rating_id":{"type":"string"},"overall_score":{"type":"number"},"service_request_title":{"type":"string"},"deep_link_path":{"type":"string"}},"required":["service_id","service_request_title"],"additionalProperties":true}'::jsonb,
    true
  )
on conflict (template_key, channel) do update set
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  variable_schema = excluded.variable_schema,
  active = excluded.active;
